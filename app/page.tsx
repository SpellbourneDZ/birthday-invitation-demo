import Invitation from "./invitation-client";
import { defaultContent } from "../lib/content";

export default function Home() {
  return <Invitation content={defaultContent} />;
}
