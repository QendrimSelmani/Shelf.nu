import type { Asset } from "@prisma/client";
import {
  unstable_composeUploadHandlers,
  unstable_createMemoryUploadHandler,
  unstable_parseMultipartFormData,
} from "@remix-run/node";
import { parse } from "csv-parse";

export type CSVData = [string[], ...string[][]] | [];

/** Parses csv Data into an array with type {@link CSVData} */
export const parseCsv = (csvData: string) => {
  const results = [] as CSVData;
  return new Promise((resolve, reject) => {
    const parser = parse({
      delimiter: ";", // Set delimiter to ; as this allows for commas in the data
      // quote: '"', // Set quote to " as this allows for commas in the data
      escape: "\\", // Set escape to \ as this allows for commas in the data
      ltrim: true, // Trim whitespace from left side of cell
      relax_quotes: true, // Allow quotes to be ignored if the character inside the quotes is not a quote
    })
      .on("data", (data) => {
        // Process each row of data as it is parsed
        // @ts-ignore
        results.push(data);
      })
      .on("error", (error) => {
        reject(error);
      })
      .on("end", () => {
        resolve(results);
      });

    parser.write(csvData);
    parser.end();
  });
};

/** Takes a request object and extracts the file from it and parses it as csvData */
export const csvDataFromRequest = async ({ request }: { request: Request }) => {
  // Upload handler to store file in memory
  const formData = await unstable_parseMultipartFormData(
    request,
    memoryUploadHandler
  );

  const csvFile = formData.get("file") as File;
  const csvData = Buffer.from(await csvFile.arrayBuffer()).toString("utf-8"); // Convert Uint8Array to string

  return (await parseCsv(csvData)) as CSVData;
};

export const memoryUploadHandler = unstable_composeUploadHandlers(
  unstable_createMemoryUploadHandler()
);

export const buildCsvDataFromAssets = ({
  assets,
  keysToSkip,
}: {
  assets: Asset[];
  keysToSkip: string[];
}) =>
  assets.map((asset) => {
    const toExport: string[] = [];

    /** Itterate over the values to create teh export object */
    Object.entries(asset).forEach(([key, value]) => {
      /** Skip keys that are not needed. These are foreign keys for the related entries */
      if (keysToSkip.includes(key)) return;

      /** If the value is null, push an empty string
       * We have a bit of a special case, for the relations that are objects, we need to push an empty object instead of an empty string.
       * This way we prevent the import from failing when importing the file again due to "Invalid JSON"
       * This needs to be done for all one-to-one relations
       */
      if (value === null) {
        if (["custody", "location", "category"].includes(key)) {
          return toExport.push("{}");
        }
        return toExport.push("");
      }

      /** Special handling for category and location */
      switch (key) {
        case "location":
        case "category":
        case "notes":
        case "tags":
        case "custody":
        case "organization":
        case "customFields":
          toExport.push(
            JSON.stringify(value, (_key, value) => {
              /** Custom replacer function.
               * We do this to ensure that in the result we have emtpy strings instead of null values
               */
              if (value === null) {
                return "";
              }
              return value;
            })
          );
          break;
        default:
          toExport.push(String(value));
      }
    });

    return toExport;
  });
