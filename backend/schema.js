export const typeDefs = `#graphql
  type Document {
    id: ID!
    name: String!
    documentType: String!
    imageBase64: String!
    extractedData: String!
    createdAt: String!
  }

  type Query {
    documents: [Document!]!
    document(id: ID!): Document
  }

  type Mutation {
    saveDocument(
      name: String!
      documentType: String!
      imageBase64: String!
      extractedData: String!
    ): Document!
    
    deleteDocument(id: ID!): Boolean!
    processOCR(imageBase64: String!): OCRResult!
  }

  type OCRResult {
    success: Boolean!
    text: String!
    hocr: String
    tsv: String
    confidence: Float!
    processingTimeMs: Int!
    fields: OCRFields!
  }

  type OCRFields {
    documentType: String
    name: String
    sex: String
    documentNumber: String
    dob: String
    nationality: String
    expiryDate: String
  }
`;
