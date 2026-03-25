import "dotenv/config";
import pool from "./pool.js";

const documentTypes = ["doc", "issue", "project", "week", "team"] as const;

const sampleDocuments = [
  // doc type
  {
    title: "Getting Started Guide",
    content: "This guide will help you get started with the Ship platform. Follow these steps to set up your workspace and create your first document.",
    document_type: "doc",
  },
  {
    title: "API Documentation",
    content: "Complete API reference for the Ship platform. Includes endpoints, authentication, and examples.",
    document_type: "doc",
  },
  // issue type
  {
    title: "Fix login bug",
    content: "Users are reporting that they cannot log in with their email address. Need to investigate the authentication flow.",
    document_type: "issue",
  },
  {
    title: "Improve performance on dashboard",
    content: "Dashboard is loading slowly when there are many documents. Consider implementing pagination or lazy loading.",
    document_type: "issue",
  },
  // project type
  {
    title: "Q1 Product Roadmap",
    content: "Key initiatives for Q1 include: new document editor, improved search, and mobile app launch.",
    document_type: "project",
  },
  {
    title: "Marketing Website Redesign",
    content: "Complete redesign of the marketing website with new branding, improved messaging, and better conversion funnel.",
    document_type: "project",
  },
  // week type
  {
    title: "Week of Jan 15, 2024",
    content: "This week we shipped the new editor, fixed 12 bugs, and onboarded 3 new customers. Next week focus on performance improvements.",
    document_type: "week",
  },
  {
    title: "Week of Jan 22, 2024",
    content: "Performance improvements deployed. Dashboard load time reduced by 40%. Started work on mobile app prototype.",
    document_type: "week",
  },
  // team type
  {
    title: "Engineering Team",
    content: "The engineering team consists of 8 developers working on backend, frontend, and mobile. We use agile methodology with 2-week sprints.",
    document_type: "team",
  },
  {
    title: "Product Team",
    content: "Product team includes 3 product managers and 2 designers. Responsible for roadmap planning, user research, and design.",
    document_type: "team",
  },
];

async function seed() {
  try {
    console.log("Starting database seed...");

    // Clear existing documents
    await pool.query("DELETE FROM documents");
    console.log("Cleared existing documents");

    // Insert sample documents
    for (const doc of sampleDocuments) {
      await pool.query(
        `INSERT INTO documents (title, content, document_type)
         VALUES ($1, $2, $3)`,
        [doc.title, doc.content, doc.document_type]
      );
      console.log(`✓ Inserted: ${doc.title} (${doc.document_type})`);
    }

    console.log(`\nSuccessfully seeded ${sampleDocuments.length} documents`);
    console.log(`- 2 docs`);
    console.log(`- 2 issues`);
    console.log(`- 2 projects`);
    console.log(`- 2 weeks`);
    console.log(`- 2 teams`);

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error("Seed failed:", error);
    await pool.end();
    process.exit(1);
  }
}

// Run seed if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seed();
}

export { seed };
