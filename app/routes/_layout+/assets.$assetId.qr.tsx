import { useMemo, useRef } from "react";
import type { Asset } from "@prisma/client";
import type { LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, Link, useLoaderData, useSubmit } from "@remix-run/react";
import domtoimage from "dom-to-image";
import { XIcon } from "~/components/icons";
import { Button } from "~/components/shared";
import { useMatchesData } from "~/hooks";
import { requireAuthSession } from "~/modules/auth";
import { createQr, generateCode, getQrByAssetId } from "~/modules/qr";
import { getCurrentSearchParams, slugify } from "~/utils";

type SizeKeys = "cable" | "small" | "medium" | "large";

export async function loader({ request, params }: LoaderArgs) {
  const { userId } = await requireAuthSession(request);
  const { assetId } = params as { assetId: string };
  const searchParams = getCurrentSearchParams(request);
  const size = (searchParams.get("size") || "medium") as SizeKeys;

  let qr = await getQrByAssetId({ assetId });
  if (!qr) {
    /** If for some reason there is no QR, we create one and return it */
    qr = await createQr({ assetId, userId });
  }

  // Create a QR code with a URL
  const { sizes, code } = await generateCode({
    version: qr.version as TypeNumber,
    errorCorrection: qr.errorCorrection as ErrorCorrectionLevel,
    size,
    qr,
  });

  return json({
    qr: code,
    sizes,
    showSidebar: true,
  });
}

export default function QRPreview() {
  const data = useLoaderData<typeof loader>();
  const formRef = useRef<HTMLFormElement>(null);
  const captureDivRef = useRef<HTMLImageElement>(null);
  const downloadQrBtnRef = useRef<HTMLAnchorElement>(null);
  const submit = useSubmit();
  const asset = useMatchesData<{ asset: Asset }>(
    "routes/_layout+/assets.$assetId"
  )?.asset;

  const fileName = useMemo(
    () =>
      `${slugify(asset?.title || "asset")}-${data.qr.size}-shelf-qr-code-${
        data.qr.id
      }.png`,
    [asset, data.qr.id, data.qr.size]
  );

  const handleSizeChange = () => {
    submit(formRef.current);
  };

  function downloadQr(e: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
    const captureDiv = captureDivRef.current;
    const downloadBtn = downloadQrBtnRef.current;
    // making sure that the captureDiv and downloadBtn exists in DOM
    if (captureDiv && downloadBtn) {
      e.preventDefault();
      domtoimage.toPng(captureDiv).then((dataUrl: string) => {
        const downloadLink = document.createElement("a");
        downloadLink.href = dataUrl;
        downloadLink.download = fileName;
        // Trigger a click event to initiate the download
        downloadLink.click();

        // Clean up the object URL after the download
        URL.revokeObjectURL(downloadLink.href);
      });
    }
  }

  return asset ? (
    <div className="">
      <header className="mb-6 flex items-center justify-between leading-7">
        <h3>Download QR Code</h3>
        <Link to=".." className="text-gray-400">
          <XIcon />
        </Link>
      </header>
      <div className="mb-4 w-auto rounded-xl border border-solid p-6">
        <div
          className="flex h-auto flex-col justify-center gap-1 rounded-md border-[5px] border-[#E3E4E8] bg-white p-3"
          ref={captureDivRef}
        >
          <div className="z-50 max-w-full truncate  text-center text-[12px]">
            {asset.title}
          </div>
          <figure className="qr-code z-[49] flex justify-center">
            <img src={data.qr.src} alt={`${data.qr.size}-shelf-qr-code.png`} />
          </figure>
          <div className="w-full text-center text-[12px]">
            <span className="block  text-gray-600">{data.qr.id}</span>
            <span className="block text-gray-500">
              Powered by{" "}
              <span className="font-semibold text-gray-600">shelf.nu</span>
            </span>
          </div>
        </div>
      </div>
      <ul className="description-list">
        <li className="mb-4 flex justify-between text-gray-600">
          <label
            htmlFor="size"
            className="key max-w-[120px] break-words font-medium"
          >
            Size
          </label>
          <span className="value max-w-[190px] break-words font-semibold">
            <Form method="get" ref={formRef}>
              <select
                name="size"
                value={data.qr.size}
                onChange={handleSizeChange}
                className=" border-none py-0 pr-6"
                style={{ backgroundPosition: "right center" }}
              >
                {Object.keys(data.sizes).map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </Form>
          </span>
        </li>
        <li className="mb-4 flex justify-between text-gray-600">
          <span className="key max-w-[120px] break-words font-medium">
            File
          </span>
          <span className="value max-w-[190px] break-words font-semibold">
            PNG
          </span>
        </li>
      </ul>
      {/* using this button to convert html to png and download image using the a tag below */}
      <Button
        icon="barcode"
        onClick={downloadQr}
        download={`${slugify(asset.title)}-${data.qr.size}-shelf-qr-code-${
          data.qr.id
        }.png`}
        ref={downloadQrBtnRef}
        variant="secondary"
        className="w-full"
      >
        Download QR Code
      </Button>
    </div>
  ) : null;
}
