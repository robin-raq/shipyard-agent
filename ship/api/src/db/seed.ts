import "dotenv/config";
import pool from "./pool.js";

const sampleDocs = [
  {
    name: "Getting Started Guide",
    content: "This guide will help you get started with the Ship platform. Follow these steps to set up your workspace and create your first document.",
  },
  {
    title: "API Documentation",
    content: "Complete API reference for the Ship platform. Includes endpoints, authentication, and examples.",
  },
];

const sampleIssues = [
  {
    title: "Fix login bug",
    content: "Users are reporting that they cannot log in with their email address. Need to investigate the authentication flow.",
    status: "open",
    priority: "high",
  },
  {
    name: "Improve performance on dashboard",
    description: "Dashboard is loading slowly when there are many documents. Consider implementing pagination or lazy loading.",
    status: "in_progress",
    priority: "medium",
  },
];

const sampleProjects = [
  {
    title: "Q1 Product Roadmap",
    description: "Key initiatives for Q1 include: new document editor, improved search, and mobile app launch.",
  },
  {
    title: "Marketing Website Redesign",
    content: "Complete redesign of the marketing website with new branding, improved messaging, and better conversion funnel.",
  },
];

const sampleWeeks = [
  {
    title: "Week of Jan 15, 2024",
    description: "This week we shipped the new editor, fixed 12 bugs, and onboarded 3 new customers. Next week focus on performance improvements.",
  },
  {
    title: "Week of Jan 22, 2024",
    description: "Performance improvements deployed. Dashboard load time reduced by 40%. Started work on mobile app prototype.",
  },
];

const sampleTeams = [
  {
    title: "Engineering Team",
    content: "The engineering team consists of 8 developers working on backend, frontend, and mobile. We use agile methodology with 2-week sprints.",
  },
  {
    name: "Product Team",
    description: "Product team includes 3 product managers and 2 designers. Responsible for roadmap planning, user research, and design.",
  },
];

async function seed() {
  try {
    console.log("Starting database seed...");

    // Clear existing data
    await pool.query("DELETE FROM docs");
    await pool.query("DELETE FROM issues");
    await pool.query("DELETE FROM projects");
    await pool.query("DELETE FROM weeks");
    await pool.query("DELETE FROM teams");
    console.log("Cleared existing data");

    // Insert sample docs
    for (const doc of sampleDocs) {
      await pool.query(
        `INSERT INTO docs (title, content)
         VALUES ($1, $2)`,
        [doc.title, doc.content]
      );
      console.log(`✓ Inserted doc: ${doc.title}`);
    }

    // Insert sample issues
    for (const issue of sampleIssues) {
      await pool.query(
        `INSERT INTO issues (title, content, status, priority)
         VALUES ($1, $2, $3, $4)`,
        [issue.title, issue.content, issue.status, issue.priority]
      );
      console.log(`✓ Inserted issue: ${issue.title}`);
    }

    // Insert sample projects
    for (const project of sampleProjects) {
      await pool.query(
        `INSERT INTO projects (title, description)
         VALUES ($1, $2)`,
        [project.title, project.content]
      );
      console.log(`✓ Inserted project: ${project.title}`);
    }

    // Insert sample weeks
    for (const week of sampleWeeks) {
      await pool.query(
        `INSERT INTO weeks (title, content)
         VALUES ($1, $2)`,
        [week.title, week.content]
      );
      console.log(`✓ Inserted week: ${week.title}`);
    }

    // Insert sample teams
    for (const team of sampleTeams) {
      await pool.query(
        `INSERT INTO teams (name, description)
         VALUES ($1, $2)`,
        [team.title, team.content]
      );
      console.log(`✓ Inserted team: ${team.title}`);
    }

    console.log(`\nSuccessfully seeded database:`);
    console.log(`- ${sampleDocs.length} docs`);
    console.log(`- ${sampleIssues.length} issues`);
    console.log(`- ${sampleProjects.length} projects`);
    console.log(`- ${sampleWeeks.length} weeks`);
    console.log(`- ${sampleTeams.length} teams`);

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
d };
