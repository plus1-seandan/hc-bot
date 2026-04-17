"use strict";

const sheet = require("./sheet");
const sheetWrite = require("./sheetWrite");
const newsletter = require("./newsletter");

const TOOLS = [
  {
    name: "get_hosting_schedule",
    description:
      "Get the house church hosting schedule for the next several weeks (last week, this week, next week, and 3 weeks after). Returns label, address, host, and date for each week. Use this when someone asks who is hosting, where HC is this week, or the upcoming host lineup.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_current_rsvps",
    description:
      "Get the current week's RSVP list — for each member whether they checked 'Dinner', 'HC only', or 'Can't join', plus any notes. Use when asked 'who's coming this week', 'who RSVP'd', or 'is X coming'.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_member_info",
    description:
      "Look up a house church member by name. Returns birthday, phone, email, address, parking instructions, HC role, LH ministry, favorite cake, SHAPE gifts, love language, blood type, and dietary restrictions. Use when asked about any personal info on a member.",
    input_schema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description:
            "Full or partial name of the member (e.g. 'Sean' or 'Hana Park')",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "list_birthdays",
    description:
      "List house church members' birthdays. Provide `days` for upcoming birthdays within N days, or `month` (1-12) to list everyone born in that month. With no arguments, returns all birthdays sorted by month/day.",
    input_schema: {
      type: "object",
      properties: {
        days: {
          type: "integer",
          description: "Upcoming window in days (e.g. 30 for next month)",
        },
        month: {
          type: "integer",
          description: "Specific month 1-12",
        },
      },
    },
  },
  {
    name: "get_prayer_requests",
    description:
      "Get the most recent week's prayer requests for the house church (column C of the PR tab). Optionally filter by a person's name. Use when asked 'what are the PRs this week' or 'what did X share for PR'.",
    input_schema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description:
            "Optional person name filter. Omit to get everyone's latest PR.",
        },
      },
    },
  },
  {
    name: "get_hosting_history",
    description:
      "Search the hosting history log. Filter by `date` (MM/DD/YY) or by `host` name. Returns the most recent matching entries. Use to answer 'when did X last host' or 'who hosted on MM/DD'.",
    input_schema: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description: "Date in MM/DD/YY format (partial match OK)",
        },
        host: {
          type: "string",
          description: "Host name (partial match OK)",
        },
        limit: {
          type: "integer",
          description: "Max entries to return (default 10)",
        },
      },
    },
  },
  {
    name: "get_newsletter",
    description:
      "Get the current weekly newsletter from Lighthouse (the parent church). Covers church-wide announcements, sermons, upcoming events, retreats, mission trips, baptisms, etc. NOT house-church-specific — for HC hosting/RSVPs/birthdays/PRs, use the HC-specific tools. Call this whenever the user asks about church-wide announcements, sermons, or events not covered by the HC tools.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "save_newsletter",
    description:
      "Save content as the current weekly Lighthouse newsletter (the parent church's weekly newsletter, not an HC-specific one). This REPLACES the previous newsletter (latest-only). Only call this AFTER the user has confirmed — do NOT call on the first message where they paste content. Always show a summary and ask 'save this as the newsletter?' first, and only save once they say yes.",
    input_schema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description:
            "The full newsletter text to save, verbatim. Preserve formatting (line breaks, bullets) as sent by the user.",
        },
      },
      required: ["content"],
    },
  },
  {
    name: "mark_attending",
    description:
      "Mark a house church member's RSVP for the current week on the 'This month' tab. This is a WRITE operation that edits the Google Sheet. Always confirm the full name before calling if there's ambiguity. Set status to 'dinner' (attending + eating), 'hc_only' (attending but skipping dinner), 'cant_join' (not coming), or 'clear' (uncheck everything). The tool will unset the other two status columns automatically.",
    input_schema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description:
            "The member's name as it appears in the RSVP list on the 'This month' tab (e.g. 'Sean Dan', 'Hana Park'). Prefer exact full names.",
        },
        status: {
          type: "string",
          enum: ["dinner", "hc_only", "cant_join", "clear"],
          description:
            "dinner = attending + eating dinner; hc_only = attending but skipping dinner; cant_join = not coming; clear = uncheck all three",
        },
        notes: {
          type: "string",
          description:
            "Optional short note to put in column E (e.g. 'arriving late', 'bringing a +1'). Omit if no note.",
        },
      },
      required: ["name", "status"],
    },
  },
];

async function dispatch(name, input, context = {}) {
  const args = input || {};
  switch (name) {
    case "get_hosting_schedule":
      return sheet.getHostingSchedule();
    case "get_current_rsvps":
      return sheet.getCurrentRsvps();
    case "get_member_info":
      return sheet.getMemberInfo(args.name);
    case "list_birthdays":
      return sheet.listBirthdays(args);
    case "get_prayer_requests":
      return sheet.getPrayerRequests(args);
    case "get_hosting_history":
      return sheet.getHostingHistory(args);
    case "get_newsletter":
      return newsletter.getLatestNewsletter();
    case "save_newsletter":
      try {
        return await newsletter.saveNewsletter({
          content: args.content,
          submittedBy: context.discordUsername,
          submittedByDisplayName: context.discordName,
        });
      } catch (err) {
        return { ok: false, error: err.message || String(err) };
      }
    case "mark_attending":
      try {
        return await sheetWrite.markAttending(args);
      } catch (err) {
        return {
          ok: false,
          error: err.message || String(err),
          candidates: err.candidates,
          notFound: err.notFound || undefined,
        };
      }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

module.exports = { TOOLS, dispatch };
