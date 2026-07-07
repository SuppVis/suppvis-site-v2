import type { Metadata } from "next";
import UnsubscribeClient from "./UnsubscribeClient";

export const metadata: Metadata = {
  title: "Unsubscribe | SuppVis",
  description: "Update your SuppVis beta email preferences.",
};

type UnsubscribePageProps = {
  searchParams?: {
    subscriber?: string;
    token?: string;
  };
};

export default function UnsubscribePage({ searchParams }: UnsubscribePageProps) {
  return (
    <UnsubscribeClient
      subscriberId={searchParams?.subscriber}
      token={searchParams?.token}
    />
  );
}
