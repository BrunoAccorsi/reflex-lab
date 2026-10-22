import { StudioWorkspace } from "@/components/studio-workspace";
import { getJevModel } from "@/server/jev";

export const dynamic = "force-dynamic";

export default function StudioPage() {
  return <StudioWorkspace model={getJevModel()} />;
}
