import { Suspense } from "react";
import GenerateView from "@/components/GenerateView";

export default function GeneratePage() {
  return (
    <Suspense>
      <GenerateView />
    </Suspense>
  );
}
