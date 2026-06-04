export interface EvalCase {
    id: string;
    category: "real" | "edge";
    subtype?: "vague" | "conflicting" | "incomplete" | "adversarial" | "minimal";
    prompt: string;
    note?: string;
}

export const DATASET: EvalCase[] = [
    // ---------- 10 real product prompts ----------
    { id: "r01", category: "real", prompt: "Build a CRM with login, contacts, dashboard, role-based access, and a premium plan with payments. Admins can see analytics." },
    { id: "r02", category: "real", prompt: "An online store with products, categories, customers, orders, and order items. Customers check out; admins manage inventory and view sales reports." },
    { id: "r03", category: "real", prompt: "A school system with students, teachers, classes, and grades. Teachers enter grades, students see only their own, admins manage everything." },
    { id: "r04", category: "real", prompt: "A helpdesk with tickets, customers, and agents. Free plan caps tickets; Pro plan unlocks analytics and priority routing." },
    { id: "r05", category: "real", prompt: "A fitness app with users, workouts, exercises, and progress logs. Premium members get custom plans and advanced analytics." },
    { id: "r06", category: "real", prompt: "A real estate platform with listings, agents, buyers, and appointments. Agents manage their own listings; admins approve them." },
    { id: "r07", category: "real", prompt: "A blog with posts, authors, categories, comments, and tags. Editors publish, readers comment, admins moderate." },
    { id: "r08", category: "real", prompt: "An expense tracker with users, expenses, categories, and budgets. Each user only sees their own data." },
    { id: "r09", category: "real", prompt: "A project management tool with teams, projects, tasks with due dates, and comments. Managers assign tasks; members update status." },
    { id: "r10", category: "real", prompt: "A job board where companies post jobs and candidates apply. Admins moderate listings and see hiring analytics." },

    // ---------- 10 edge cases ----------
    { id: "e01", category: "edge", subtype: "vague", prompt: "Build me an app for my business.", note: "should flag vague + document assumptions" },
    { id: "e02", category: "edge", subtype: "minimal", prompt: "notes app", note: "infer a Note entity from two words" },
    { id: "e03", category: "edge", subtype: "vague", prompt: "Something to manage stuff with users.", note: "extreme underspecification" },
    { id: "e04", category: "edge", subtype: "conflicting", prompt: "A public forum where anyone can post anonymously, but every user must log in and only admins can see posts.", note: "anonymous vs login; public vs admin-only" },
    { id: "e05", category: "edge", subtype: "incomplete", prompt: "A CRM with premium features.", note: "premium named but undefined → synthesize plans" },
    { id: "e06", category: "edge", subtype: "conflicting", prompt: "A todo app where users can delete other users' tasks but cannot see them.", note: "delete what you cannot read" },
    { id: "e07", category: "edge", subtype: "adversarial", prompt: "A marketplace with super-admins, admins, managers, users, guests, and moderators.", note: "6 roles → permission assignment" },
    { id: "e08", category: "edge", subtype: "adversarial", prompt: "A calculator.", note: "non-CRUD app; should degrade gracefully" },
    { id: "e09", category: "edge", subtype: "incomplete", prompt: "A booking system.", note: "no entities specified; infer bookings/resources" },
    { id: "e10", category: "edge", subtype: "conflicting", prompt: "An e-commerce site that is completely free with no products, but charges customers for premium product listings.", note: "free-but-charges; no products but product listings" },
];