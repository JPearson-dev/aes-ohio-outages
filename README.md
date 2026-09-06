# AES Ohio Outage Tracker

This repository automatically tracks power outages in the AES Ohio (formerly DP&L) service area. It polls the utility's public map data to build a historical, incident-level dataset that is otherwise unavailable to the public.

This is the `main` branch, which hosts the code for collecting and making sense of the data. The `data` branch is for data.

## 📊 How This Data Can Be Used

***TODO: the project is temporarily just the data collection. A UI should be available by 9/10/26.***

Commercial outage aggregators typically roll up data to the county, city, or zip-code level. By tracking the raw incident data over time, this dataset enables:

* **Temporal Accessibility:** A time-lapse view. The simple feeling that you can see what is happening. The ability to not just see a number go down, but to see the dots disappear as incidents resolve. The ability to see how big those numbers were before, so you know how bad it got and that progress has been steadily made, without needing to remember or physically record the numbers for yourself.
* **Restoration Dynamics:** Have incidents near me been resolved recently? Have incidents of the size affecting me been resolved recently? Are larger outages typically resolved faster than smaller ones? Provide an unofficial estimate for how long recovery will take.
* **Anomaly Detection:** Identifying long-lived outages that persist after the main recovery period.
* **Incident Dynamics:** Correlating weather events to the physical size and spread of failures. Where did the storm hit first?

This project doesn't aim to implement all of those features, but it might try to answer many of them. And where the project doesn't provide an analysis, other members of the community can do their own.

## 📡 Data Source & Civic Usage

The data is sourced directly from the public, unauthenticated XML endpoint used by the official AES Ohio outage map (`dplomsdata.xml`).

This project operates under a strict "polite polling" policy:

* **Matched Frequency:** The script polls the endpoint every 15 minutes, matching the refresh rate of the utility's own dashboard.
* **Negligible Footprint:** The request fetches a small XML file, avoiding the additional bandwidth overhead for a web browser to load the full dashboard.

## ⚙️ Architecture (The Git Scraping Pattern)

This project uses **Git Scraping**, a pattern pioneered by the civic tech community to archive shifting public data.

1. A GitHub Actions cron job runs a lightweight Python script every 15 minutes.
2. The script fetches the XML, parses it into sorted JSON to ensure clean diffs, and logs the current total to a heartbeat file.
3. If the incident data has changed (new outages appeared, or existing ones dropped off), the changes are committed to the `data` branch.
4. Git's version history acts as a time-series database.

## ⚖️ Policy & Acceptable Use

This project operates on the principle that civic data relevant to public safety and utility reliability should be accessible for non-commercial analysis.

* **Public Access:** The data is public and unauthenticated. This project uses the same endpoint as AES Ohio's official dashboard. Under established legal precedent (such as the CFAA rulings in *Van Buren* and *hiQ Labs v. LinkedIn*), automated access of public web data does not constitute unauthorized access.
* **Absence of Damages:** The system generates no meaningful load and causes no service degradation. Its operation is equivalent to someone leaving the dashboard open on a desktop computer.
* **GitHub Acceptable Use:** GitHub allows Actions related to the production, testing, deployment, or publication of a software project. Data collection is a necessary prequisite for producing and testing software built to display the data. Making the data available for visitors is also part of publication of a usable webapp. While GitHub restricts using Actions as a "serverless backend," they permit and host thousands of Git Scraping projects for civic data, provided the compute burden remains negligible (running for ~3 seconds every 15 minutes) and the data contributes to an open-source research project.

If you represent AES Ohio or GitHub and disagree with this understanding, please contact a project maintainer or submit an Issue on this GitHub project.

---

For more background on the methodology powering this repository, you can review Simon Willison's talk on [Git scraping, the five minute lightning talk](https://www.youtube.com/watch?v=2CjA-03yK8I), which demonstrates using this exact pattern to track PG&E outages.
