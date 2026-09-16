import { getCodeCollection } from "../services/vector-store.service.js";

const collection = await getCodeCollection();

const result = await collection.get({
    where: {
        repositoryId: "metadata-test-20260913",
    },
    include: ["embeddings", "documents", "metadatas"],
});

console.log("IDs:", result.ids.length);
console.log("First document:", result.documents?.[0]);
console.log("First metadata:", result.metadatas?.[0]);
console.log(
    "Embedding dimensions:",
    result.embeddings?.[0]?.length
);