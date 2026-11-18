import type { Metadata } from "next";
import UnsubscribeClient from "./UnsubscribeClient";
import BoundaryStatement from "../components/BoundaryStatement";

export const metadata: Metadata = {
  title: "Unsubscribe | SuppVis",
  description: "Opt out of SuppVis beta email updates.",
};

type UnsubscribePageProps = {
  searchParams?: {
    subscriber?: string;
    token?: string;
  };
};

export default function UnsubscribePage({ searchParams }: UnsubscribePageProps) {
  return (
    <>
      <UnsubscribeClient
        subscriberId={searchParams?.subscriber}
        token={searchParams?.token}
      />
      <BoundaryStatement />
    </>
  );
}
