import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

type SidebarItem = Extract<SidebarsConfig[string], unknown[]>[number];

const doc = (id: string, label: string): SidebarItem => ({ type: "doc", id, label });

const category = (id: string, label: string, items: SidebarItem[]): SidebarItem => ({
  type: "category",
  label,
  link: { type: "doc", id },
  items,
});

const section = (label: string, items: SidebarItem[]): SidebarItem => ({
  type: "category",
  label,
  collapsible: false,
  items,
});

const sidebars: SidebarsConfig = {
  docs: [
    doc("README", "Introduction"),
    section("Build with Verax", [
      doc("getting-started", "Quickstart"),
      doc("developer-guides/networks-and-addresses", "Networks and Addresses"),
      category("developer-guides/for-attestation-issuers/README", "Build Workflow", [
        doc("developer-guides/for-attestation-issuers/create-a-schema", "Create and register a Schema"),
        doc("developer-guides/for-attestation-issuers/create-a-module", "Create a Module"),
        doc("developer-guides/for-attestation-issuers/register-a-module", "Register a Module"),
        doc("developer-guides/for-attestation-issuers/create-a-portal", "Create a Portal"),
        doc("developer-guides/for-attestation-issuers/register-a-portal", "Register a Portal"),
        doc("developer-guides/for-attestation-issuers/create-an-attestation", "Create an Attestation"),
        doc("developer-guides/for-attestation-issuers/encoding-attestation-data", "Encoding Attestation Data"),
        doc("developer-guides/for-attestation-issuers/revoke-an-attestation", "Revoke an Attestation"),
        doc("developer-guides/for-attestation-issuers/replace-an-attestation", "Replace an Attestation"),
        doc("developer-guides/for-attestation-issuers/bulk-create-attestations", "Bulk Create Attestations"),
        doc("developer-guides/for-attestation-issuers/link-attestations", "Link Attestations"),
        doc("developer-guides/offchain-payloads", "Offchain Payloads"),
        doc("developer-guides/for-attestation-issuers/eas-compatibility", "EAS Interoperability"),
      ]),
      doc("developer-guides/using-the-sdk", "Using the SDK"),
      doc("developer-guides/using-the-subgraph", "Using the Subgraph"),
      doc("developer-guides/using-the-explorer", "Using the Explorer"),
      doc("developer-guides/deploying-a-verax-instance", "Deploy a Verax Instance"),
      category("discover/modules-standard-library/README", "Standard Library Modules", [
        doc("discover/modules-standard-library/ecdsamodule", "ECDSAModule"),
        doc("discover/modules-standard-library/erc1271module", "ERC1271Module"),
        doc("discover/modules-standard-library/feemodule", "FeeModule"),
        doc("discover/modules-standard-library/indexermodule", "IndexerModule"),
        doc("discover/modules-standard-library/issuersmodule", "IssuersModule"),
        doc("discover/modules-standard-library/schemamodule", "SchemaModule"),
        doc("discover/modules-standard-library/sendermodule", "SenderModule"),
      ]),
      category("developer-guides/tutorials/README", "Tutorials", [
        doc("developer-guides/tutorials/from-a-schema-to-an-attestation", "From a Schema to an Attestation"),
        doc("developer-guides/tutorials/using-ceramic-to-store-the-attestation-payload", "Ceramic Integration Example"),
      ]),
      category("developer-guides/examples", "Examples", [
        doc("discover/standard-library/nft-portal", "NFT-Compatible Portal Example"),
      ]),
    ]),
    section("Research Verax", [
      doc("core-concepts/high-level-overview", "High-Level Overview"),
      doc("core-concepts/attestations", "Attestations"),
      doc("core-concepts/schemas", "Schemas"),
      doc("core-concepts/linked-data", "Linked Data"),
      doc("core-concepts/canonical-schemas", "Canonical Schemas"),
      doc("core-concepts/modules", "Modules"),
      doc("core-concepts/portals", "Portals"),
      doc("core-concepts/trust-model-and-limitations", "Trust Model and Limitations"),
      doc("core-concepts/verax-vs-eas-and-other-attestation-models", "Verax vs EAS, NFTs, SBTs and VCs"),
      doc("core-concepts/ecosystem", "Ecosystem"),
    ]),
    section("Protocol & Community", [
      doc("discover/integrations", "Integrations"),
      category("get-involved/governance/README", "Governance", [
        doc("get-involved/governance/governance-charter", "Governance Charter"),
        doc("get-involved/governance/governance-parameters", "Governance Parameters"),
        doc("get-involved/governance/overview-of-governance", "Overview of Governance"),
        doc("get-involved/governance/proposal-templates", "Proposal Templates"),
      ]),
      doc("get-involved/contribute", "Contribute"),
      doc("get-involved/get-in-touch", "Get in Touch"),
    ]),
  ],
};

export default sidebars;
