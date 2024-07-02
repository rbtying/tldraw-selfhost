import { CONNECTION_STRING } from "./config";
import { YDocProvider } from "@y-sweet/react";
import { getOrCreateDocAndToken } from "@y-sweet/sdk";
import DirectoryMetadata from "./DirectoryMetadata";
import Tldraw from "./Tldraw";

type HomeProps = {
  searchParams: Record<string, string>;
};

export default async function Home({ searchParams }: HomeProps) {
  const directoryClientToken = await getOrCreateDocAndToken(
    CONNECTION_STRING,
    "dirtree"
  );
  const clientToken = await getOrCreateDocAndToken(
    CONNECTION_STRING,
    searchParams.doc
  );

  return (
    <>
      <YDocProvider clientToken={directoryClientToken}>
        {clientToken.docId && <DirectoryMetadata docId={clientToken.docId} />}
        <YDocProvider clientToken={clientToken} setQueryParam="doc">
          <div className="h-5/6">
            <Tldraw docId={clientToken.docId} />
          </div>
        </YDocProvider>
      </YDocProvider>
    </>
  );
}
