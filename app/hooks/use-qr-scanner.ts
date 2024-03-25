import { useEffect, useState } from "react";
import { useNavigate } from "@remix-run/react";
import { useMediaDevices } from "react-media-devices";
import { useZxing } from "react-zxing";
import { ShelfError } from "~/utils/error";
import { useClientNotification } from "./use-client-notification";

// Custom hook to handle video devices
export const useQrScanner = () => {
  const navigate = useNavigate();
  const [sendNotification] = useClientNotification();
  const [selectedDevice, setSelectedDevice] = useState("");
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const { devices } = useMediaDevices({
    constraints: {
      video: true,
      audio: false,
    },
  });

  // Initialize videoMediaDevices as undefined. This will be used to store the video devices once they have loaded.
  const [videoMediaDevices, setVideoMediaDevices] = useState<
    MediaDeviceInfo[] | undefined
  >();

  useEffect(() => {
    if (devices) {
      const videoDevices = devices.filter(
        (device) => device.kind === "videoinput"
      );

      if (videoDevices.length === 0) {
        return;
      }

      setVideoMediaDevices(videoDevices);

      // Set the selected device to the first video device
      setSelectedDevice(videoDevices[0]?.deviceId || "");

      // Set hasPermission to true as devices are available
      setHasPermission(true);
    } else {
      // Set hasPermission to false as devices are not available
      setHasPermission(false);
    }
  }, [devices]);

  // Use the useZxing hook to access the camera and scan for QR codes
  const { ref } = useZxing({
    deviceId: selectedDevice,
    constraints: { video: true, audio: false },
    onDecodeResult(result) {
      decodeQRCodes(result.getText());
    },

    onError(cause) {
      /** This is not idea an kinda useless actually
       * We are simply showing the message to the user based on hasPermission so if they deny permission we show a message
       */
      throw new ShelfError({
        message: "Unable to access media devices permission",
        status: 403,
        label: "Scanner",
        cause,
      });
    },
  });

  // Function to decode the QR code
  const decodeQRCodes = (result: string) => {
    if (result != null) {
      const regex = /^(https?:\/\/)([^/:]+)(:\d+)?\/qr\/([a-zA-Z0-9]+)$/;
      /** We make sure the value of the QR code matches the structure of Shelf qr codes */
      const match = result.match(regex);
      if (!match) {
        /** If the QR code does not match the structure of Shelf qr codes, we show an error message */
        sendNotification({
          title: "QR Code Not Valid",
          message: "Please Scan valid asset QR",
          icon: { name: "trash", variant: "error" },
        });
        return;
      }

      sendNotification({
        title: "Shelf's QR Code detected",
        message: "Redirecting to mapped asset",
        icon: { name: "success", variant: "success" },
      });
      const qrId = match[4]; // Get the last segment of the URL as the QR id
      navigate(`/qr/${qrId}`);
    }
  };

  return {
    ref,
    videoMediaDevices,
    selectedDevice,
    setSelectedDevice,
    hasPermission,
  };
};