import type { Metadata } from "next";
import { StorageView } from "@/components/views/storage-view";

export const metadata: Metadata = {
  title: "Storage analyser",
  description:
    "Measure browser origin storage and model real device storage pressure from totals you read in your OS settings.",
};

export default function StoragePage() {
  return <StorageView />;
}
