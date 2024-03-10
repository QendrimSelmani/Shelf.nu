import type { ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { parseFormAny } from "react-zorm";
import { z } from "zod";

import { sendOTP } from "~/modules/auth";
import { validEmail } from "~/utils";
import { assertIsPost } from "~/utils/http.server";

export async function action({ request }: ActionFunctionArgs) {
  assertIsPost(request);

  const formData = await request.formData();
  const result = await z
    .object({
      /**
       * .email() has an issue with validating email
       * addresses where the there is a subdomain and a dash included:
       * https://github.com/colinhacks/zod/pull/2157
       * So we use the custom validation
       *  */
      email: z
        .string()
        .transform((email) => email.toLowerCase())
        .refine(validEmail, () => ({
          message: "Please enter a valid email",
        })),
      mode: z.enum(["login", "signup", "confirm_signup"]).optional(),
    })
    .safeParseAsync(parseFormAny(formData));

  if (!result.success) {
    return json(
      {
        error: "Please enter a valid email.",
      },
      { status: 400 }
    );
  }

  const { error } = await sendOTP(result.data.email);

  if (error) {
    return json(
      {
        error: error.message,
      },
      { status: 500 }
    );
  }

  return redirect(
    `/otp?email=${encodeURIComponent(result.data.email)}&mode=${
      result.data.mode
    }`
  );
}
