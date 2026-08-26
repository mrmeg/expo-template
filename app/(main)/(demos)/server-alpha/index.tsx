// Both exports are declarations on purpose. `expo export`'s loader detection
// only recognizes a declared `loader`, and it only strips the screen from the
// loader bundle when `default` is declared too — specifier re-exports are
// skipped either way. See docs/server-guide.md → Data Loaders, guarded by
// server/__tests__/loaderExportShape.test.ts.
import { serverAlphaLoader } from "@/client/features/server-alpha/loaders";
import ServerAlphaDemoScreen from "@/client/features/server-alpha/ServerAlphaDemoScreen";

export const loader = serverAlphaLoader;
export default ServerAlphaDemoScreen;
