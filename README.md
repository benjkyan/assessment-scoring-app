# \#Assessment Scoring App



A web app for scoring skill-based behavioral assessments and tracking a

client's progress across repeated evaluations.



\## Why



Over two summers at a behavioral therapy clinic I digitized three clinical

assessment instruments as automated spreadsheets. In total, I digitized 

approximately 37 skill domains and roughly 14,000+ formulas between them. 

Initial feedback from clinicians reported that evaluations which had taken 

multiple days could be completed in one; however, while the spreadsheets 

worked, they were also fickle: the scoring logic for all three sheets live in 

thousands of formulas without any real data model underneath. This project

are those sheets rebuilt as an application.



\## About the data



The instruments I worked with are copyrighted commercial products, so none

of their item text appears here. This repo ships with a small synthetic

catalog (`data/sample-catalog.json`) of invented domains and skill items.

Under HIPPA, no client data of any kind is in this repository or its history.



\## Data model



An instrument is a catalog: domains -> subdomains -> skills. Each skill has

an ID, a description, and examples. A score is (skill, occasion, value 0-5),

where 0 means not applicable. Domain and subdomain totals are derived, never

stored. The denominator for a percentage is recomputed from the items

actually scored, so not-applicable items don't distort the result.



\## Status



Early - building in the open.



\## Running it



TBD

