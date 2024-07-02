import { CONNECTION_STRING } from "../config";
import { YDocProvider } from "@y-sweet/react";
import { getOrCreateDocAndToken } from "@y-sweet/sdk";
import Tldraw from "./Tldraw";

type EditorProps = {
  searchParams: Record<string, string>;
};

export default async function Editor({ searchParams }: EditorProps) {
  const clientToken = await getOrCreateDocAndToken(
    CONNECTION_STRING,
    searchParams.doc
  );

  return (
    <>
      <YDocProvider clientToken={clientToken} setQueryParam="doc">
        <div className="h-full w-full absolute">
          <Tldraw docId={clientToken.docId} />
        </div>
      </YDocProvider>
    </>
  );
}

export const dynamic = "force-dynamic";
