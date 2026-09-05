<div align="center">

# Assessment Scoring App

**A web app for scoring skill-based behavioral assessments and tracking a client's progress across repeated evaluations.**

[Live demo →](https://benjkyan.github.io/assessment-scoring-app/)

</div>

---

## What it does

Behavioral clinicians typically assess a client against an assessment instrument of their choosing. Virtually all of these instruments are, in reality, just a very long list of skills: hundreds upon thousands of items, grouped into domains, re-run every few months to track progress. This app attempts to replace the spreadsheet that the results from those assessments usually live in.

To begin, you add a client, start an assessment, and score each skill from 0 to 5 (or leave it blank if it wasn't administered). Totals update as you go, each client keeps a history of dated assessments, and any assessment can be exported to CSV.


## Why I built this

Over two summers at a behavioral therapy clinic, I digitized three clinical assessment instruments as automated spreadsheets, with roughly 37 skill domains and 14,000+ formulas between them. I was very pleased with the result: clinicians reported that evaluations which had taken multiple days could be finished in one.

However, the digitized instruments could be very fickle as well. All of the scoring logic lived *in the formulas*, which came with a whole host of issues. For example, adding a domain meant re-inputting every score calculation by hand. A single dragged cell could completely break a subtotal, and I wouldn't know unless deliberately combing through the sheet. Google App Script also came with many runtime issues which I encountered as well. 

Thus, this project is those sheets rebuilt as an application, hopefully to address many of the scalability and runtime issues I ran into. The project contains three main parts: a **catalog** (the list of all tests), a **score set** (what a clinician enters on one occasion), and a **rollup layer** that derives all the calculations. The nice thing about this structure is that this generic project is easily adaptable to various kinds of assessments. All you have to do is swap the JSON catalog and the whole app re-renders.

## Features

- **Animations.** Hover and focus transitions on interactive controls and newly rendered sections.
- **Mobile responsiveness.** Automatically adjusts positioning of GUI for mobile users.
- **A color system.** Scores and dashboard percentages scale from red to green, which helps create more clarity for the user. 
- **API calls.** When the page opens, the app asks the server for the skill catalog file and waits for it to come back before rendering anything (`fetch` with `async`/`await`). If the request fails, the app will report back on screen.
- **Objects.** All the data is stored as objects nested inside each other: a client holds a list of assessments, and each assessment holds its scores. The scores are kept as a lookup table (skill ID -> number) so getting any individual score is instant, so no searching through a list.
- **Persistence.** A dedicated storage module (`store.js`) wraps `localStorage`, which allow you to resume exactly where you left off even after reloading the page, with the same client and same assessment.
- **Catalog-driven rendering.** The catalog is a JSON file (`domains → subdomains → skills`) and there is no assessment-specific code anywhere in the app. This allows for the ability to rewrite the catalog freely, making the whole app re-render around it.
- **Deployed** on GitHub Pages.
- **CSV export.** Builds a file laid out similarly to the clinic's already existing workbook template and downloads it.
- **Two percentages.** Every domain shows both `earned / applicable` and `earned / total`. Clinicians rarely administer every item in one sitting, so counting the un-administered ones as zeros will generally undersell the true performance of the client. An unscored skill plays no role in the calculation of the score object, which allows for increased flexibility in assessment and evaluation metrics.


## Time spent

Roughly **~10 hours** total, across multiple sittings between September 1 and 5, 2026. That covers the scoring mechanism and calculation, the client/assessment design, CSV export, and styling, as well as time spent learning and working through JS, HTML, CSS, Git, etc. 


## A note about the data

The assessments I worked with are copyrighted commercial products, so **none of their actual text appears here.** This repo ships a small invented catalog (`data/sample-catalog.json`) with fictional domains and skill items, written to demonstrate the same structure. For obvious reasons, no real client data of any kind is in this repo or its history.


## Running it

**Deployed on GitHub Pages:** [benjkyan.github.io/assessment-scoring-app](https://benjkyan.github.io/assessment-scoring-app/)

Simply add a client, create a trial, and you can start scoring! Data is stored in your browser only.


## To-Implement List

- Chart view: chart one client's domain scores across assessments
- Ability to directly import prior assessments from .csv files
- Per-skill notes: highly requested feature for clinicians
- A real backend, if and only if figure out solid security for storing sensitive client information
