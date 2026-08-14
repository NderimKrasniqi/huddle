import { PurposeScreen } from '@huddle/ui/native';

/** Camera configuration and QR parsing remain available; this phase does not mount the camera. */
export function ScanScreen() {
  return <PurposeScreen platform="phone" purpose="Scan a room code" />;
}
