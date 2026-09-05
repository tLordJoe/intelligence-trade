# Fund Holdings Data — Republication and Derived-Use Rights Audit

**Prepared for:** Outfox Markets (https://outfoxmarkets.com) — commercial, advertising-supported public website
**Use case under review:** display to anonymous, non-logged-in visitors of (a) each ETF's complete holdings list, (b) top-ten weights, (c) a concentration measure, and (d) a computed holdings-overlap percentage between two or more funds.
**Date of evidence collection:** September 5, 2026. All quotes below were taken from pages fetched on that date.

**Governing principle applied throughout:** public downloadability without a login is not a licence. Where a source is silent, or where a page could not be reached, this report states **"written permission required"** and does not infer permission.

---

## A. SEC EDGAR — Form N-PORT (NPORT-P)

### A.1 Copyright / usage status of EDGAR content

The SEC's own dissemination policy is the operative permission:

> "Information presented on sec.gov is considered public information and may be copied or further distributed by users of the web site without the SEC's permission."
> — [SEC, Privacy and Internet Security Policy / Website Dissemination](https://www.sec.gov/about/privacy-information#dissemination)

> "Please consider appropriate citation to the SEC as the source."
> — [SEC, Privacy and Internet Security Policy](https://www.sec.gov/about/privacy-information#dissemination)

The SEC Webmaster FAQ confirms this extends to **filer-generated filing content**, not just SEC-authored pages:

> "All Government-created content on sec.gov and EDGAR public filing content are free to access and reuse."
> — [SEC Webmaster FAQ](https://www.sec.gov/os/webmaster-faq)

The FAQ also confirms very little of sec.gov is third-party-licensed:

> "Very little." … "Examples include stock art photos used to illustrate various sec.gov pages."
> — [SEC Webmaster FAQ](https://www.sec.gov/os/webmaster-faq)

### A.2 Government-generated vs. filer-generated — and what it means

NPORT-P content is **filer-generated**: the registrant (Vanguard, Invesco, SSGA, VanEck, BlackRock) prepares and files it. Under 17 U.S.C. §105 only *U.S. Government works* are excluded from copyright, so filer-generated text is **not** automatically public domain by operation of §105. The reuse permission therefore rests on two independent grounds:

1. **Express SEC permission.** The SEC's dissemination policy expressly covers "EDGAR public filing content," which is filer-generated, and declares it "free to access and reuse" ([SEC Webmaster FAQ](https://www.sec.gov/os/webmaster-faq)); and information on sec.gov "may be copied or further distributed by users of the web site without the SEC's permission" ([SEC dissemination policy](https://www.sec.gov/about/privacy-information#dissemination)).
2. **Thin-to-no copyright in the data itself.** An N-PORT holdings schedule is a factual list of securities, quantities, values and percentages. Facts are not copyrightable, and a mechanical, unselective enumeration of a portfolio has no original selection or arrangement.

Practical consequence: the *SEC-filed* version of a fund's holdings is the only version of that same data that carries an affirmative, written reuse permission from its publisher. The identical numbers obtained from the issuer's own website carry no such permission (Sections B–F).

**Trademark carve-outs that do apply:**

> "Please do not use the SEC seal or any of the other logos or artwork from this site."
> "In addition, please be advised that 'SEC,' the EDGAR logo, and the names EDGAR, EDGARLink, and EDGARLink Online are the SEC's registered trademarks."
> "You may not use them in a trade name, trademark, or domain name of an SEC- or EDGAR-related business without a license from the SEC."
> "You may refer in text to the existence of EDGAR and the EDGAR system without a license, so long as you are not creating the impression that your business is affiliated with or approved by the SEC."
> — [SEC dissemination policy](https://www.sec.gov/about/privacy-information#dissemination)

### A.3 Automated access rules

> "We allow scripted access to sec.gov content and have some resources for developers:"
> "Note that our current maximum access rate is 10 requests per second."
> "Please declare your **user agent** in request headers:" — with sample `User-Agent: Sample Company Name AdminContact@<sample company domain>.com`, `Accept-Encoding: gzip, deflate`, `Host: www.sec.gov`
> — [SEC Webmaster FAQ](https://www.sec.gov/os/webmaster-faq)

> "To ensure everyone has equitable access to SEC EDGAR content, please use efficient scripting."
> "Download only what you need and please moderate requests to minimize server load."
> "**Current max request rate: 10 requests/second.**"
> "The SEC does not allow botnets or automated tools to crawl the site."
> — [SEC, Accessing EDGAR Data](https://www.sec.gov/os/accessing-edgar-data)

> "Current guidelines limit users to a total of no more than 10 requests per second, regardless of the number of machines used to submit requests."
> "We reserve the right to block IP addresses that submit excessive requests."
> "Once the rate of requests has dropped below the threshold for 10 minutes, the user may resume accessing content on SEC.gov."
> — [SEC Internet Security Policy](https://www.sec.gov/about/privacy-information#dissemination)

`robots.txt` expressly permits the filing archive path:

```
User-agent: *
Allow: /Archives/edgar/data
Disallow: /cgi-bin
Disallow: /search/
Disallow: /Archives/bin
```
— [https://www.sec.gov/robots.txt](https://www.sec.gov/robots.txt)

Note the interaction: `/Archives/edgar/data` (the filing documents) is **Allowed**; `/cgi-bin` (the legacy `browse-edgar` interface) and `/search/` are **Disallowed**. Directory listing of CIK subdirectories is expressly supported: "Directory browsing is allowed for the Central Index Key (CIK) child directories of /Archives/edgar/data/." ([SEC Webmaster FAQ](https://www.sec.gov/os/webmaster-faq)). Use the `data.sec.gov` submissions JSON and full-text search API rather than `/cgi-bin/browse-edgar`.

### A.4 Practical constraints — filing lag and which months are public

Current operative text of Rule 30b1-9:

> "Reports filed pursuant to paragraph (a) of this section for the third month of each fiscal quarter shall be made publicly available no later than 60 days after the end of the fiscal quarter."
> "Reports filed pursuant to paragraph (a) of this section for the first and second months of each fiscal quarter shall not be made publicly available."
> — [17 CFR § 270.30b1-9 (eCFR, current)](https://www.ecfr.gov/current/title-17/chapter-II/part-270/section-270.30b1-9)

The SEC describes the same regime and the (as-yet-uneffective) change:

> "Currently, funds file these monthly reports on a quarterly basis within 60 days after quarter-end."
> "The amendments will also make funds' monthly reports on Form N-PORT available to the public 60 days after the end of each month instead of every third month of a quarter only."
> — [SEC Press Release 2024-110](https://www.sec.gov/newsroom/press-releases/2024-110)

Those amendments are **not in force**. The SEC extended them by two years:

> "The compliance date for larger fund groups is extended from Nov. 17, 2025, to Nov. 17, 2027" … "the compliance date for smaller fund groups is extended from May 18, 2026, to May 18, 2028."
> — [SEC Press Release 2025-64](https://www.sec.gov/newsroom/press-releases/2025-64)

And in February 2026 the SEC proposed to reverse the public-monthly element altogether:

> "Reduce the publication of reports from monthly to quarterly, a change designed to protect a fund's shareholders by reducing the risks of more frequent public disclosure, such as external parties using information about a fund's portfolio holdings in ways that increase costs for the fund and its shareholders"
> "Provide reporting funds with an additional 15 days to file monthly reports of portfolio-related information on Form N-PORT"
> — [SEC Press Release 2026-19](https://www.sec.gov/newsroom/press-releases/2026-19-sec-proposes-amendments-reduce-burdens-reporting-fund-portfolio-holdings)

**Planning conclusion for A.4:** as of September 2026, EDGAR gives you **one public holdings snapshot per fiscal quarter (the quarter-end month only), available up to 60 days after quarter end**. Worst case staleness is roughly 5 months (a March 31 snapshot is public by ~May 30 and remains the newest until the June 30 snapshot appears ~Aug 29). Months 1 and 2 of each quarter are, by rule, not public. Do not architect around a monthly EDGAR feed: the monthly-public regime is deferred to Nov 2027/May 2028 and is currently proposed to be withdrawn.

### A.5 Verdict — SEC EDGAR / NPORT-P

**REPUBLICATION EXPRESSLY PERMITTED**

Justified by: "Information presented on sec.gov is considered public information and may be copied or further distributed by users of the web site without the SEC's permission" ([SEC](https://www.sec.gov/about/privacy-information#dissemination)) and "All Government-created content on sec.gov and EDGAR public filing content are free to access and reuse" ([SEC](https://www.sec.gov/os/webmaster-faq)).

| Question | Answer |
|---|---|
| (i) Raw holdings list verbatim? | **Yes.** Expressly permitted; content "may be copied or further distributed … without the SEC's permission." |
| (ii) Derived aggregate only (overlap %, top-ten weight, concentration index)? | **Yes.** A fortiori — derived aggregates are a lesser use than the permitted verbatim copying, and are in any event uncopyrightable facts computed by Outfox. |
| (iii) Automated/scripted download? | **Permitted, conditionally.** "We allow scripted access to sec.gov content"; max 10 requests/second; declared descriptive `User-Agent` with contact e-mail required; `/Archives/edgar/data` Allowed in robots.txt, `/cgi-bin` and `/search/` Disallowed. |
| (iv) Caching / storage? | **Not restricted.** No storage prohibition appears in any SEC policy page fetched. "Download only what you need" is a load-management request, not a retention limit. Local caching is in fact encouraged by the efficient-scripting guidance. |
| (v) Attribution? | **Requested, not mandated.** "Please consider appropriate citation to the SEC as the source." Treat as mandatory in practice. Do **not** use the SEC seal or EDGAR logo, and do not imply affiliation. |

---

## B. Vanguard (VOO) — Vanguard Index Funds / vanguard.com

### B.1 Terms of use

> "Vanguard grants you a limited, revocable, nonexclusive, nontransferable license to view, store, bookmark, download, and print the pages within this Site solely for your **personal, informational, and noncommercial use** or as expressly authorized by Vanguard in writing."
> — [Vanguard Terms and Conditions of Use](https://investor.vanguard.com/terms-conditions)

> "Except as otherwise stated in these Terms of Use or as expressly authorized by Vanguard in writing, **you may not (or enable others to):**
> - Modify, copy, screen capture, distribute, forward, transmit, post, display, perform, reproduce, publish, broadcast, license, **create derivative works from**, transfer, sell, or exploit any reports, data, information, content, software, RSS and podcast feeds, products, services, or other materials on, generated by or obtained from this Site, whether through links or otherwise (collectively, 'Materials');
> - Redeliver any page, text, image, or Materials on this Site using '**framing**' or other technology;
> - Engage in any conduct that could damage, disable, or overburden (i) this Site … including without limitation, **using devices or software that provide repeated automated access to this Site**, other than those made generally available by Vanguard;"
> — [Vanguard Terms and Conditions of Use](https://investor.vanguard.com/terms-conditions) (identical text at [Vanguard T&C PDF](https://investor.vanguard.com/ts/pdf/terms_and_conditions.pdf))

> "The Materials on this Site are for information, education, and noncommercial purposes only."
> — [Vanguard Terms and Conditions of Use](https://investor.vanguard.com/terms-conditions)

Linking is also constrained — relevant because an "overlap" page will cite Vanguard as source:

> "The Link must resolve either to Vanguard's portal page at www.vanguard.com, or to the appropriate one of Vanguard's homepages … unaltered in any way"
> "The text of the Link must read either 'The Vanguard Group,' 'Vanguard,' 'Vanguard Group,' 'Vanguard.com,' or 'www.vanguard.com.' You may not use any Vanguard logo or graphic … without Vanguard's express written permission"
> "If you have created a Link that conforms to these Linking Conditions, then you also may include one or more Links to any internal or subsidiary page of this Site … (known as 'deep links'), provided, however, that all such deep links must be in close physical proximity to the Link that conforms to the Linking Conditions. **You may not maintain numerous or pervasive Links to this Site.**"
> — [Vanguard Terms and Conditions of Use](https://investor.vanguard.com/terms-conditions)

RSS feeds — the only syndication channel Vanguard licenses — are expressly barred from ad-supported contexts:

> "You may not incorporate advertising into or targeted towards the content of Vanguard's Feeds or insert any intermediate page, splash page, or other content or materials between any hyperlink to Vanguard's Feeds and the applicable Vanguard website page."
> — [Vanguard Terms and Conditions of Use](https://investor.vanguard.com/terms-conditions)

### B.2 robots.txt

```
User-agent: *
Disallow: /images/
Disallow: /static/
Disallow: /404

Sitemap: https://investor.vanguard.com/sitemap-index.xml
```
— [https://investor.vanguard.com/robots.txt](https://investor.vanguard.com/robots.txt)

```
# robots.txt for http://www.vanguard.com/
User-agent: *
Disallow: /web/stylesheet/
Disallow: /web/images/
Disallow: /web/javascript/
Disallow: /images/
...
Disallow: /us/content/SiteWide/LglDocs/SWLglTermsConditionsContent.jsp
Disallow: /vfap/
Disallow: /us/AffordingRetirement
Disallow: /afford
Disallow: /us/whatweoffer/advice/financialplanningservices
Disallow: /pdf/a131.pdf*
```
— [https://www.vanguard.com/robots.txt](https://www.vanguard.com/robots.txt)

**No fund-data path is Disallowed on either host.** This is important and must not be misread: robots.txt permits crawling of fund pages, while the Terms of Use separately prohibit "repeated automated access" and any copying, republication or derivative work. The robots file is a crawler-etiquette control, not a licence. Where robots.txt is permissive and the Terms are prohibitive, the Terms govern the reuse question.

### B.3 Verdict — Vanguard (VOO), issuer-website version

**REPUBLICATION EXPRESSLY PROHIBITED**

| Question | Answer |
|---|---|
| (i) Raw holdings list verbatim? | **No.** "you may not … copy … distribute … publish … reproduce … any reports, data, information, content … on, generated by or obtained from this Site." |
| (ii) Derived aggregate only? | **No.** The same clause expressly bars "create derivative works from" the Materials, and the licence is limited to "personal, informational, and noncommercial use." An overlap percentage computed from Vanguard-sourced holdings is a derivative use on a commercial site. |
| (iii) Automated/scripted download? | **Prohibited by the Terms** ("using devices or software that provide repeated automated access to this Site, other than those made generally available by Vanguard"), notwithstanding that robots.txt does not disallow fund-data paths. |
| (iv) Caching / storage? | **Partially addressed.** The licence permits "view, store, bookmark, download, and print … solely for your personal, informational, and noncommercial use." Server-side caching for a public commercial site falls outside that grant — written permission required. |
| (v) Attribution? | No attribution licence for data. Trademark/logo use requires "Vanguard's express written permission" (intellectualproperty@vanguard.com). Linking must follow the Linking Conditions and must not be "numerous or pervasive." |

---

## C. Invesco (QQQ) — invesco.com / invesco.com/qqq-etf

### C.1 Terms of use

> "All information and materials contained on the Website are subject to copyright and/or trademark protection laws and are **provided solely for your personal non-commercial or internal business use**."
> — [Invesco Terms of Use §4](https://www.invesco.com/us/en/resources/terms-of-use.html)

> "Invesco hereby grants you a limited, non-exclusive and revocable license to access and make personal use of the Website, **but not to download (other than page caching and mobile applications to authorized platforms) or modify them**, or any portion of them, except with the express prior written consent of Invesco."
> — [Invesco Terms of Use §9](https://www.invesco.com/us/en/resources/terms-of-use.html)

> "In addition, users and visitors of the Website may not:
> 1. **Copy, reproduce, republish, upload, post, transmit, or distribute in any way material from the Website** in any manner inconsistent with the purposes for which it is offered by Invesco to its customers, prospective customers or members of the general public.
> 3. **Redeliver any of the pages, text, images, or other content of the Website using 'framing' technology** without Invesco's express written permission.
> 4. **Use devices (including software) that are designed to provide repeated automated access to the Website** other than those made generally available by Invesco.
> 8. **Resell or provide commercial use of the Website or the content therein, or create any derivative use of the Website or the content therein; or use any data mining, robots, or similar data gathering and extraction tools on the Website.**
> 9. **Reproduce, duplicate, copy, sell, resell, visit, or otherwise exploit for any commercial purpose the Website** without the express prior written consent of Invesco."
> — [Invesco Terms of Use §10](https://www.invesco.com/us/en/resources/terms-of-use.html)

Caching is the single narrow carve-out: §9 permits "page caching" only, as an exception to a prohibition on downloading.

### C.2 robots.txt

```
# Invesco
User-agent: *

Allow: .js
Allow: .css

#Parameters
Disallow: /*asOfDate=
Disallow: /*startDate=
Disallow: /*endDate=
Disallow: /*trustStatus=
Disallow: /*.zip
Disallow: /*FilterList=
...
Disallow: /*mutual-funds/quarterly-holdings
Disallow: /*collective-trust-funds/products/holdings

User-agent: AhrefsBot
Disallow: /
```
— [https://www.invesco.com/robots.txt](https://www.invesco.com/robots.txt)

Two directives bear directly on holdings: **`Disallow: /*mutual-funds/quarterly-holdings`** and **`Disallow: /*collective-trust-funds/products/holdings`** are explicit holdings-path exclusions, and **`Disallow: /*asOfDate=`** excludes the dated-query pattern used by Invesco's holdings endpoints. So unlike Vanguard, Invesco's robots.txt is itself partly prohibitive on holdings paths.

### C.3 Downloadability of a daily holdings file

**Blocked — reported rather than substituted.** Every scripted request to Invesco holdings endpoints was refused:

- `https://www.invesco.com/us/financial-products/etfs/holdings/main/holdings/0?audienceType=Investor&action=download&ticker=QQQ` → **HTTP 406 Not Acceptable**, zero bytes, with both a descriptive research User-Agent and a standard browser User-Agent plus full browser headers and Referer.
- `https://www.invesco.com/qqq-etf/en/holdings.html` → **HTTP 406 Not Acceptable**, zero bytes.
- `https://www.invesco.com/qqq-etf/en/legal.html` → **HTTP 406**.
- By contrast `https://www.invesco.com/qqq-etf/en/about.html` returned HTTP 200, confirming the block is targeted at holdings/legal paths, not a site-wide outage.

I therefore cannot confirm from primary evidence the existence, URL or format of a publicly downloadable QQQ daily holdings file. Invesco actively refuses non-browser access to that path. Combined with `Disallow: /*asOfDate=`, the server behaviour and robots.txt together indicate that programmatic retrieval is not sanctioned.

### C.4 Verdict — Invesco (QQQ), issuer-website version

**REPUBLICATION EXPRESSLY PROHIBITED**

| Question | Answer |
|---|---|
| (i) Raw holdings list verbatim? | **No.** "Copy, reproduce, republish, upload, post, transmit, or distribute in any way material from the Website" is prohibited; content is "solely for your personal non-commercial or internal business use." |
| (ii) Derived aggregate only? | **No.** §10.8 bars "create any derivative use of the Website or the content therein" and "provide commercial use of … the content therein." |
| (iii) Automated/scripted download? | **Prohibited**, on three independent grounds: §10.4 (repeated automated access), §10.8 ("data mining, robots, or similar data gathering and extraction tools"), and robots.txt `Disallow: /*mutual-funds/quarterly-holdings`, `Disallow: /*asOfDate=`. Enforced in practice by HTTP 406 responses. |
| (iv) Caching / storage? | **Addressed and narrowly permitted only as "page caching"** (§9). Any other download or storage requires "the express prior written consent of Invesco." |
| (v) Attribution? | No attribution licence. "Without Invesco's express written permission, copy, modify, or display Invesco's name or logo, or any text, graphic images, or other content from the Website" is prohibited (§10.2). |

---

## D. State Street / SSGA (XLK, XLU) — ssga.com and sectorspdrs.com

### D.1 sectorspdrs.com now redirects wholesale to ssga.com — verified

Independently confirmed by HEAD requests:

- `https://www.sectorspdrs.com/` → `HTTP/1.0 302 Moved Temporarily`, `Location: https://www.ssga.com/`
- `https://www.sectorspdrs.com/robots.txt` → `HTTP/1.0 302`, `Location: https://www.ssga.com/robots.txt`
- `https://www.sectorspdrs.com/mainfund/xlk` → `HTTP/1.0 302`, `Location: https://www.ssga.com/mainfund/xlk`

**Consequence:** sectorspdrs.com has no separate terms of use and no separate robots.txt. The SSGA terms and the SSGA robots.txt are the governing documents for XLK and XLU. Any prior assumption that the Sector SPDR site carried lighter terms is obsolete.

### D.2 SSGA terms — verified verbatim (the prior partial understanding is confirmed and extended)

> "Unless otherwise indicated either in the Site or herein, State Street Investment Management or its affiliates own the copyright and any other intellectual property rights subsisting anywhere in the world to the information on this Site. **You may not copy, reproduce, duplicate, modify, adopt or lend, sell, disseminate or otherwise transfer, in whole or in part, any of the information contained in this Site, except for the purpose of accessing the Site and producing print-outs for your own personal use, or making a reasonable number of copies of such pages for internal use within your organization** in accordance with this Agreement. Users of this Site shall not remove, alter, or obscure any copyright, trademark, trade secret or other proprietary rights notices appearing in or on the website, and shall reproduce all such notices on any copies of content made by or on behalf of users."
> — [SSGA Terms and Conditions, "Access"](https://www.ssga.com/us/en/footer/terms-and-conditions)

> "You will not, and will cause your employees and Authorized Designees not to, (i) permit any third party to use the Site or the remote access services related to the Site, (ii) sell, rent, license or otherwise use the Site or the remote access services related to the Site in the operation of a service bureau or for any purpose other than as expressly authorized under this Agreement, … (iv) **allow or cause any information transmitted from State Street Investment Management's databases, including data from third party sources, available through use of the Site or the remote access services, to be published, redistributed or retransmitted for other than use for or on behalf of yourself**, as State Street Investment Management's customer, and (v) use more than one asset identifier per security. **In no event may you use the data and information on the Site in lieu of obtaining appropriate licenses from the applicable Supplier**, and State Street Investment Management may limit the use of this Site accordingly."
> — [SSGA Terms and Conditions, "Restrictions on use"](https://www.ssga.com/us/en/footer/terms-and-conditions)

> "You agree that neither you nor your Authorized Designees will modify the Site in any way, **enhance or otherwise create derivative works based upon the Site**, nor will you or your Authorized Designees reverse engineer, decompile or otherwise attempt to secure the source code for all or any part of the Site."
> — [SSGA Terms and Conditions, "Modification of the Site"](https://www.ssga.com/us/en/footer/terms-and-conditions)

> "**No other site, without the prior written permission of State Street Investment Management, is authorized to link to any part of this Site.**"
> — [SSGA Terms and Conditions, "Hyperlinks"](https://www.ssga.com/us/en/footer/terms-and-conditions)

> "All equipment, systems, services and software are to be used for your business purposes only in accordance with the terms of this Agreement and your agreement(s) with State Street Investment Management. **Unauthorized access, use or distribution is in violation of state and/or federal statutes.**"
> — [SSGA Terms and Conditions, "Access"](https://www.ssga.com/us/en/footer/terms-and-conditions)

**Silence determination (as requested):** the SSGA Terms are **silent on automated access, robots, spiders, scrapers and data mining**, and **silent on caching or storage** other than by implication from the copy prohibition. For both of those two questions the answer is therefore: **written permission required.** Note also the linking clause is stricter than any other issuer here — even a plain hyperlink to ssga.com requires prior written permission.

### D.3 robots.txt (serves both ssga.com and, by redirect, sectorspdrs.com)

```
User-agent: *
Disallow: /weblogic/strategyDetailsPublic
Disallow: /weblogic/ContactServlet
Disallow: /webapp/prdlistServlet
Disallow: /disclaimers/
Disallow: /inf
Disallow: /dec-of-t
Disallow: /funddec
Disallow: /doc/Legal
Disallow: /fd
Disallow: /search-results
Disallow: /library-content/assets/pdf/documents
```
— [https://www.ssga.com/robots.txt](https://www.ssga.com/robots.txt) (identical content served for [https://www.sectorspdrs.com/robots.txt](https://www.sectorspdrs.com/robots.txt) after the 302)

The daily-holdings path (`/library-content/products/fund-data/etfs/us/`) is **not** Disallowed; only `/library-content/assets/pdf/documents` is. So robots.txt does not block the holdings file, but the Terms of Use prohibit republication and redistribution of it regardless.

### D.4 Downloadability

Confirmed downloadable without login or click-through:
`https://www.ssga.com/us/en/intermediary/library-content/products/fund-data/etfs/us/holdings-daily-us-en-xlk.xlsx` → **HTTP 200**, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, 22,902 bytes, redirecting to `https://www.ssga.com/library-content/products/fund-data/etfs/us/holdings-daily-us-en-xlk.xlsx`. The equivalent `-xlu.xlsx` path follows the same pattern.

This is the paradigm case for the brief's core question: the file downloads to an anonymous script with no barrier whatsoever, and is nonetheless covered by an express prohibition on publication, redistribution and retransmission.

### D.5 Verdict — SSGA (XLK, XLU), issuer-website version

**REPUBLICATION EXPRESSLY PROHIBITED**

| Question | Answer |
|---|---|
| (i) Raw holdings list verbatim? | **No.** "You may not copy, reproduce, duplicate … disseminate or otherwise transfer, in whole or in part, any of the information contained in this Site, except … print-outs for your own personal use, or … internal use within your organization." Plus: data "may not … be published, redistributed or retransmitted." |
| (ii) Derived aggregate only? | **No.** "enhance or otherwise create derivative works based upon the Site" is prohibited, and the redistribution bar covers "any information transmitted from State Street Investment Management's databases." Also expressly: "In no event may you use the data and information on the Site in lieu of obtaining appropriate licenses from the applicable Supplier" — which reaches the S&P sector classification embedded in XLK/XLU holdings (Section G.1). |
| (iii) Automated/scripted download? | **Unaddressed in the Terms** — no robots/spider/data-mining clause exists. robots.txt does not disallow the holdings path. Because the Terms are silent: **written permission required.** |
| (iv) Caching / storage? | **Unaddressed / not expressly permitted.** No caching or retention clause exists. **Written permission required.** |
| (v) Attribution? | **Yes, mandatory where any copy is made:** "shall reproduce all such notices on any copies of content made by or on behalf of users" (copyright/trademark/proprietary-rights notices must be carried through). Separately, linking to the site at all requires prior written permission. |

---

## E. VanEck (SMH) — vaneck.com

### E.1 Terms

> "All text and graphics/images contained on this site are subject to copyright and/or trademark protection. VanEck owns or is licensed to use the rights to all brand names, product names, trademarks and service marks except as otherwise noted. **No information contained on this site may be reproduced, transmitted, displayed, distributed, published or otherwise used for commercial purposes without the prior consent of VanEck.** You may, however, print or electronically store copies of the information for your own personal use."
> — [VanEck Legal, "Copyrights/Trademarks/Licenses"](https://www.vaneck.com/us/en/legal/)

> "Copyright © 2025, American Bankers Association. CUSIP Database provided by S&P Global Market Intelligence LLC. All rights reserved."
> — [VanEck Legal, "CUSIP Identifiers"](https://www.vaneck.com/us/en/legal/)

The CUSIP notice is operationally significant: if the SMH holdings file carries CUSIPs, republishing the CUSIP column implicates a separate ABA/S&P Global Market Intelligence licence, independent of the VanEck permission question. Strip CUSIPs from anything you display or store.

**Silence determination:** the VanEck legal page is **silent on republication as distinct from commercial use, on framing, on deep linking, on derivative works, on automated access/robots/scrapers/data mining, on caching or storage, on database rights, and on attribution requirements.** For each of those: **written permission required.**

### E.2 robots.txt

```
# robots.txt for http://www.vaneck.com/
User-agent: *
#We put the crawl delay at 25 seconds MOZ policy only allows crawl if delay is within 30 Seconds.
Crawl-delay: 25

Disallow: /admin/*
Disallow: /Workarea/
Disallow: /Private/
Disallow: /market-vectors/equity-etfs/colx/holdings/
Disallow: /market-vectors/equity-etfs/gerj/holdings/
Disallow: /market-vectors/equity-etfs/latm/holdings/
Disallow: /market-vectors/equity-etfs/rkh/holdings/
Disallow: /FundHoldings.aspx?ticker=CHLC
Disallow: /download-pdf-options/*
```
— [https://www.vaneck.com/robots.txt](https://www.vaneck.com/robots.txt)

The `Disallow` holdings entries are all for **delisted/closed funds** (COLX, GERJ, LATM, RKH, CHLC). **No SMH path is Disallowed.** The site-wide `Crawl-delay: 25` is the binding crawler constraint — one request per 25 seconds.

### E.3 Downloadability

**Blocked — reported rather than substituted.** `https://www.vaneck.com/us/en/investments/semiconductor-etf-smh/holdings/` returned **HTTP 302** to `https://www.vaneck.com/row/disabled-cookies/`, and `https://www.vaneck.com/api/etf/holdings/?ticker=SMH` returned **HTTP 302** to `https://www.vaneck.com/corp/en/disabled-cookies`. VanEck requires a cookie-bearing browser session; a plain script is redirected to a "disabled cookies" interstitial. I could not confirm the existence, URL or format of a publicly downloadable SMH holdings file from primary evidence.

### E.4 Verdict — VanEck (SMH), issuer-website version

**REPUBLICATION EXPRESSLY PROHIBITED**

| Question | Answer |
|---|---|
| (i) Raw holdings list verbatim? | **No.** "No information contained on this site may be reproduced, transmitted, displayed, distributed, published or otherwise used for commercial purposes without the prior consent of VanEck." An ad-supported public site is a commercial purpose; the only grant is "for your own personal use." |
| (ii) Derived aggregate only? | **No.** The prohibition reaches information "otherwise used for commercial purposes," which is broader than reproduction and captures derived commercial analysis. Separately note the MarketVector index-data restrictions in G.3, which independently bar derived works. |
| (iii) Automated/scripted download? | **Unaddressed in the terms.** robots.txt does not disallow SMH paths but imposes `Crawl-delay: 25`. In practice, scripted access is technically blocked by a cookie redirect. Because the terms are silent: **written permission required.** |
| (iv) Caching / storage? | **Partially addressed:** "You may, however, print or electronically store copies of the information for your own personal use." Storage for a public commercial site is outside that grant — **written permission required.** |
| (v) Attribution? | **Unaddressed.** No attribution clause. Separate ABA/S&P Global CUSIP copyright notice applies to CUSIP identifiers. |

---

## F. iShares / BlackRock (SOXX) — ishares.com

### F.1 Which terms govern

The iShares US site footer "Terms & Conditions" link resolves to the BlackRock corporate terms — verified from the raw HTML of the iShares SOXX page, which contains `href="https://www.blackrock.com/corporate/compliance/terms-and-conditions"`. `https://www.ishares.com/us/legal-information` and `.../legal-information/terms-and-conditions` both return **HTTP 404** ("Page unavailable"), so there is no separate live iShares-US terms document; the corporate terms are the operative ones.

> "The content contained on this Website is owned or licensed by BlackRock and its third-party information providers and is protected by applicable copyrights, trademarks, service marks, and/or other intellectual property rights. **Such content is solely for your personal, non-commercial use. Accordingly, you may not copy, distribute, modify, post, frame or deep link this Website**, including any text, graphics, video, audio, software code, user interface design or logos. **You may download material displayed on this Website for your personal use provided you also retain all copyright and other proprietary notices contained on the materials. You may not distribute, modify, transmit, reuse, repost, or use the content of this Website for public or commercial purposes**, including all text, images, audio, and video, without BlackRock's written permission."
> — [BlackRock Terms and Conditions, "Trademarks, Copyrights and other Intellectual Property"](https://www.blackrock.com/corporate/compliance/terms-and-conditions)

> "**You shall not display hyperlinks on your websites to any website owned or operated by BlackRock.** If you desire to display on your website a hyperlink to a BlackRock website, you must enter into a written agreement with BlackRock governing such display."
> — [BlackRock Terms and Conditions, "Links to BlackRock from Other Websites"](https://www.blackrock.com/corporate/compliance/terms-and-conditions)

> "Except as otherwise stated in these Terms or as expressly authorized by BlackRock in writing, you may not: … **Use any robot, spider, intelligent agent, other automatic device, or manual process to search, monitor or copy this Website or the reports, data, information, content, software, products services, or other materials on, generated by or obtained from this Website**, whether through links or otherwise (collectively, 'Materials'), **without BlackRock's permission**, provided that generally available third-party web browsers may be used without such permission"
> — [BlackRock Terms and Conditions, "Prohibited Uses"](https://www.blackrock.com/corporate/compliance/terms-and-conditions)

> "If you download any information from this Website, you agree that you will not copy it or remove or obscure any copyright or other notices or legends contained in any such information."
> — [BlackRock Terms and Conditions](https://www.blackrock.com/corporate/compliance/terms-and-conditions)

Caching is mentioned only as a browser-hygiene instruction, not a licence: "you are responsible for setting the cache settings on your browser to ensure you are receiving the most recent data" ([BlackRock T&C, "Timeliness of Content"](https://www.blackrock.com/corporate/compliance/terms-and-conditions)).

### F.2 Do the CSV endpoint's terms differ from the site terms? Is there a click-through?

**They do not differ in substance — the download carries its own restated disclaimer with identical restrictions, and there is no click-through acceptance gate.**

The SOXX product page HTML embeds a download-specific disclaimer keyed `download.xls-holdings-analytics.disclaimer`, retrieved from `https://www.ishares.com/us/products/239705/ishares-phlx-semiconductor-etf/1467271812596.ajax?fileType=csv&fileName=SOXX_holdings&dataType=fund`:

> "The content contained herein is owned or licensed by BlackRock and/or its third-party information providers and is protected by applicable copyrights, trademarks, service marks, and/or other intellectual property rights. **Such content is solely for your personal, non-commercial use. Accordingly, you may not copy, distribute, modify, post, frame or deep link this content.** You may download material displayed on this Website for your personal use provided you also retain all copyright and other proprietary notices contained on the materials. Modification or use of the materials for any other purpose violates BlackRock's intellectual property rights. Holdings subject to change. See www.iShares.com for the most recent funds holdings."
> — `download.xls-holdings-analytics.disclaimer`, embedded in [the iShares SOXX holdings download response](https://www.ishares.com/us/products/239705/ishares-phlx-semiconductor-etf/1467271812596.ajax?fileType=csv&fileName=SOXX_holdings&dataType=fund)

A near-identical `download.xls-product-page.disclaimer` appears alongside it. The same response also carries an MSCI notice applicable to certain analytics columns:

> "Certain information contained herein (the 'Information') has been provided by MSCI ESG Research LLC … and **it may not be reproduced or redisseminated in whole or in part without prior written permission. … The Information may not be used to create any derivative works**"
> — MSCI notice embedded in [the same iShares response](https://www.ishares.com/us/products/239705/ishares-phlx-semiconductor-etf/1467271812596.ajax?fileType=csv&fileName=SOXX_holdings&dataType=fund)

**Click-through:** none is imposed. There is no "I accept" gate. Instead the endpoint performs **User-Agent / session gating**: the URL advertises `Content-Type: text/csv;charset=UTF-8` and returns HTTP 200, but the 1,410,292-byte body is the product-page **HTML**, not CSV, for both a descriptive research User-Agent and a standard Chrome User-Agent with Referer. The CSV is served only to a full browser session. So the practical position is: the terms are imposed by browsewrap (footer link plus in-page disclaimer), and the CSV is technically withheld from scripts. That combination is the worst case for an automated pipeline — no acceptance record exists to negotiate against, and the anti-bot control is an independent access barrier.

### F.3 robots.txt

```
User-agent: Brightbot 1.0
Disallow: /

User-agent: *

Disallow: /*?truepdf*
Disallow: /*?norepdf*
Disallow: /*.dl$
Disallow: /*sign-on.oauth
Disallow: /*sign-on.saml
Disallow: /*sign-on-popup.saml
Disallow: /search/
Disallow: /us/MYCATEGORYURL
```
— [https://www.ishares.com/robots.txt](https://www.ishares.com/robots.txt)

The `.ajax` holdings endpoint is **not** Disallowed. Again: robots.txt permissiveness does not create a licence, and the Terms independently prohibit "any robot, spider, intelligent agent, other automatic device."

### F.4 Verdict — iShares/BlackRock (SOXX), issuer-website version

**REPUBLICATION EXPRESSLY PROHIBITED**

| Question | Answer |
|---|---|
| (i) Raw holdings list verbatim? | **No.** "solely for your personal, non-commercial use … you may not copy, distribute, modify, post, frame or deep link this content" and "You may not distribute, modify, transmit, reuse, repost, or use the content of this Website for public or commercial purposes … without BlackRock's written permission." |
| (ii) Derived aggregate only? | **No.** "use the content of this Website for public or commercial purposes" is prohibited without written permission — that language reaches derived commercial use, not merely verbatim copying. The MSCI notice adds an express "may not be used to create any derivative works" bar for MSCI-sourced columns. |
| (iii) Automated/scripted download? | **Expressly prohibited.** "Use any robot, spider, intelligent agent, other automatic device, or manual process to search, monitor or copy this Website or the … data … without BlackRock's permission, provided that generally available third-party web browsers may be used without such permission." Enforced technically: the CSV endpoint returns HTML to non-browser clients. |
| (iv) Caching / storage? | **Addressed only for personal use.** "You may download material displayed on this Website for your personal use provided you also retain all copyright and other proprietary notices." Server-side caching for a commercial site — **written permission required.** |
| (v) Attribution? | **Yes, mandatory if any download is retained:** you must "retain all copyright and other proprietary notices contained on the materials" and must not "remove or obscure any copyright or other notices or legends." Separately, hyperlinking to any BlackRock site requires a written agreement. |

---

## G. Index providers — is the constituent list / classification separately restricted?

This layer matters because it survives the fund layer. Even where the fund holdings are lawfully sourced from EDGAR, a display that is *equivalent to* an index constituent list, or that reproduces a licensed sector classification, can infringe the index provider's rights independently.

### G.1 S&P Dow Jones Indices — XLK, XLU sector definitions (GICS)

> "S&P Dow Jones Indices grants you a non-exclusive, non-transferable, limited, revocable license to access and use the web site and its Content (as defined below) subject to the terms set forth below."
> "The content of the Web includes, but is not limited to, text, data, reports, images, photos, graphics, graphs, charts, animations, and videos (collectively, the 'Content')."
> "**You agree not to copy, reproduce, modify, display, perform, publish, distribute, transmit, broadcast, circulate, create derivative works from, store, or link to the web site or any Content without the express prior written consent of S&P Dow Jones Indices** (which may be in the form of an email)."
> "**Without limiting the foregoing, the Content may not be used in connection with the creation, structuring, development, calculation, compilation, publication or distribution of any financial instrument or product or any index or investment strategy.**"
> — [S&P Dow Jones Indices Terms of Use](https://www.spglobal.com/spdji/en/terms-of-use/)

This is the strictest general clause in the audit: it bars copying, storing, creating derivative works from, **and even linking to** the Content absent written consent.

**robots.txt could not be retrieved — reported, not substituted.** `https://www.spglobal.com/robots.txt` returned an Akamai **"Access Denied … You don't have permission to access"** page, and `https://www.spglobal.com/spdji/en/robots.txt` returned **HTTP 403**. Both with a descriptive research User-Agent. Automated-access status via robots.txt is therefore unknown: **written permission required.**

**Verdict: REPUBLICATION EXPRESSLY PROHIBITED.** Practical rule for Outfox: do not label a holdings display as "the Technology Select Sector Index constituents," do not reproduce GICS sector or sub-industry labels sourced from SSGA/S&P, and do not present XLK/XLU holdings as an index constituent list. Whether a fund's holdings — sourced from EDGAR and labelled as *the fund's holdings* — are separately restricted by SPDJI is a question of the SPDJI Content definition; the material fetched here does not reach data the fund filed with the SEC, but note SSGA's own instruction that you may not use SSGA data "in lieu of obtaining appropriate licenses from the applicable Supplier" ([SSGA](https://www.ssga.com/us/en/footer/terms-and-conditions)).

### G.2 Nasdaq — QQQ / Nasdaq-100

> "Subject to your compliance with this Agreement, Nasdaq grants you a **personal, limited, revocable, non-exclusive, non-assignable, non-sublicensable and non-transferable license to use the Services solely for your personal, non-commercial use. Except as expressly authorized by Nasdaq, you agree not to sell, copy, distribute, or create derivative works based on the Services, in whole or in part.**"
> — [Nasdaq Legal / Terms of Service §6](https://www.nasdaq.com/legal)

> "**You shall not share, transfer, disclose, copy, publish or create derivative works from the content, incl. associated metadata (the 'Content') or the Service without Nasdaq's prior written approval.**"
> "Except as detailed in Section 6, you shall not market, sell or distribute the Services or otherwise provide the Services to any third parties including, but not limited to, **placing or distributing any Nasdaq's content on a third party platform** … without Nasdaq's prior written consent."
> — [Nasdaq Legal / Terms of Service §7](https://www.nasdaq.com/legal)

> "**Not access or use the Service, or any process, whether automated or manual, to capture data or content from the Service** or circumvent any mechanisms for preventing the unauthorized reproduction or distribution of the Service for any reason;"
> — [Nasdaq Legal / Terms of Service §2](https://www.nasdaq.com/legal)

> "You agree not to use, copy, or extract any part of the Content, including but not limited to text, images, data, code, databases, directories content, and information or materials (including associated metadata) for the purpose of training, coding or development of artificial intelligence systems, machine learning models, or any other form of data analysis software without Nasdaq's express written permission, including, but not limited to, scraping, data mining, and the use of any automated or manual process to capture or compile content"
> — [Nasdaq Legal / Terms of Service §7](https://www.nasdaq.com/legal)

Linking is restricted to a text-only homepage link: "the link must be a text-only link clearly marked 'Nasdaq Home Page' or 'nasdaq.com'", "must point to the URL 'https://www.nasdaq.com' and not to other pages within the Nasdaq Site" ([Nasdaq §6](https://www.nasdaq.com/legal)).

The dedicated index-site disclaimers add nothing further: [indexes.nasdaq.com/Home/Disclaimer](https://indexes.nasdaq.com/Home/Disclaimer) and [indexes.nasdaqomx.com/Home/Disclaimer](https://indexes.nasdaqomx.com/Home/Disclaimer) both carry only "©2026. Nasdaq, Inc. All Rights Reserved." with no reuse clauses — on those two pages, silence, so **written permission required** as to anything not covered by the main Terms.

robots.txt: `https://www.nasdaq.com/robots.txt` **could not be retrieved** (connection returned HTTP 000 / no response with a descriptive research User-Agent) — reported, not substituted. The index sub-site is retrievable and minimal:
```
User-agent: *
Disallow: /indexblog/archive/
Disallow: /hottopics/
```
— [https://indexes.nasdaqomx.com/robots.txt](https://indexes.nasdaqomx.com/robots.txt)

**Verdict: REPUBLICATION EXPRESSLY PROHIBITED.** Practical rule: do not present QQQ holdings as "the Nasdaq-100 constituents," do not use Nasdaq-sourced index membership or weights, and do not use Nasdaq Content to train or develop any analytical/ML software.

### G.3 MarketVector / MVIS — SMH

> "a) The User may receive, download, store and use Data **solely for internal informational purposes**."
> "b) **The User may not store any Data to create historical databases.**"
> "c) **The User may not create derived works such as data, works, indices, charts, reports or any kind of products which are in way derived from the Data.**"
> "d) **The User may not store, reproduce, further transmit, distribute or make available to third persons / parties any Data or any works derived from Data in any type of format or by any means** (including but not limited to the internet, intranet or other type of network distribution)."
> "f) The User may not use the Data in any way or for any purpose that would require a separate license from the Company or other third persons / parties."
> "g) The User may not use the Data on behalf of, or for the benefit of, anyone else."
> — [MarketVector Terms of Service §4.1](https://www.marketvector.com/terms-of-service)

> "MarketVector is monitoring the use of the Services on its Website for excessive use. In case of excessive use, MarketVector reserves the right, at its own discretion, to 1) identify users that are using the Services on its Website excessively beyond the scope of these TOS, which restricts the use to internal informational purposes, 2) block such users from the Services, 3) delete the account of such users, and/or 4) to request that the user shall enter into a License Agreement with MarketVector for the use of the Services."
> — [MarketVector Terms of Service §2.4](https://www.marketvector.com/terms-of-service)

> "If the User is in breach of any provision(s) of this clause 4, the Company is entitled to block the User's access to the Website with immediate effect without any notice and, additionally, to make the User's further use of Data contingent on the User, or its employer, entering into a license agreement with the Company and paying a license fee pursuant to the Company's then current pricing **which would apply retrospectively**."
> — [MarketVector Terms of Service §4.2(a)](https://www.marketvector.com/terms-of-service)

> "The MarketVector™ family of indexes (MarketVector™, Bluestar®, MVIS®) is protected through various intellectual property rights and unfair competition and misappropriation laws."
> — [MarketVector Disclaimer](https://www.marketvector.com/disclaimer)

This is the only source in the audit that **expressly prohibits derived aggregates by name** ("may not create derived works such as data, works, indices, charts, reports") and **expressly prohibits historical storage** ("may not store any Data to create historical databases") — the two features Outfox specifically wants. It also carries a retrospective-fee remedy.

robots.txt **could not be retrieved** — reported, not substituted. Both `https://www.marketvector.com/robots.txt` and `https://marketvector.com/robots.txt` returned **HTTP 403** CloudFront "Request blocked" pages with a descriptive research User-Agent. Automated-access status via robots.txt: unknown, **written permission required.**

**Verdict: REPUBLICATION EXPRESSLY PROHIBITED.**

### G.4 ICE / NYSE — SOXX (ICE Semiconductor Index)

> "By entering the ICE Index Platform ('IIP') you acknowledge and agree that your access to the IIP and receipt of ICE Data Indices, LLC ('ICE Data') index data and information is subject to the following: **except as provided in a relevant agreement, you may not use, share, disclose, transmit, publish, distribute, disseminate, scrape, or commercialize, either in whole or in part, either directly or indirectly through any third parties, the index data or information contained herein.**"
> — [ICE Index Platform Disclaimer](https://indices.ice.com/html/ICEDisclaimer.htm)

Note that this clause names **scraping** and **commercialization** explicitly. When re-fetched directly by curl the same URL returned a 169-byte shell (JavaScript-rendered), so the text above is quoted from the rendered fetch of the same URL.

The ICE Data Indices subscription terms confirm that even licensed subscribers get a narrow, internal-only grant:

> "ICE Data hereby grants to Subscriber … a limited, personal, non-exclusive, non-transferable, non-sublicensable license, to use the Index and the Index Data **internally** for benchmarking solely within the Territory … Subscriber is expressly restricted from any use of the Index Data other than for the purposes permitted herein."
> "Subscriber may not (i) create a blended benchmark index based solely on Indices, or (ii) create a custom benchmark/any index based in whole or in part on **Constituent Data or Derived Constituent Data** (as defined herein)."
> "Subscriber is permitted to store the Index Data on its own database or on a hosted server that is **restricted to the Subscriber's own internal use** … Except as expressly permitted herein, Subscriber may not share the Index Data with any third party without ICE Data's prior written consent."
> — [ICE Data Indices, Terms and Conditions for the Index Data and Custom Index Services](https://www.ice.com/publicdocs/IDI_-_Terms_and_Conditions_for_the_Index_Data_and_Custom_Index_Services_2026_Changes.pdf)

The defined terms "Constituent Data" and "Derived Constituent Data" confirm that ICE treats constituent-level data and anything derived from it as separately licensable — directly on point for a holdings-overlap feature.

robots.txt for the corporate host is retrievable and does not disallow index paths:
```
User-agent: *
Disallow: /product-guide-partials/
Disallow: /flyout/
Disallow: /side-nav/
Disallow: /header/
Disallow: /health-check
Disallow: /report-center/category/
Disallow: /report-partial/
Disallow: /report-center-folio
Disallow: /FuturesEuropeRegulations.shtml
```
— [https://www.ice.com/robots.txt](https://www.ice.com/robots.txt)

**Verdict: REPUBLICATION EXPRESSLY PROHIBITED.**

### G.5 Index-layer answers to the five standard questions

| Provider | (i) Verbatim constituent list | (ii) Derived aggregate only | (iii) Automated download | (iv) Caching/storage | (v) Attribution |
|---|---|---|---|---|---|
| S&P DJI (XLK/XLU sectors, GICS) | No — written consent required | No — "create derivative works from … or store" prohibited | robots.txt unretrievable (403/Access Denied) → **written permission required** | Prohibited — "store" is in the prohibited list | Not stated → **written permission required** |
| Nasdaq (QQQ) | No — "not … copy, publish or create derivative works from the content" | No — derivative works barred; "personal, non-commercial use" only | Prohibited — no "automated or manual" process to capture data; scraping/data mining named | Not separately addressed beyond the copy/publish bar → **written permission required** | Text-only homepage link only; no data attribution licence |
| MarketVector/MVIS (SMH) | No — "may not … reproduce, further transmit, distribute or make available to third persons" | **No — expressly**: "may not create derived works such as data, works, indices, charts, reports" | robots.txt unretrievable (403) ; TOS monitors "excessive use" and may compel a licence → **written permission required** | **Prohibited expressly**: "may not store any Data to create historical databases" | Not stated → **written permission required** |
| ICE/NYSE (SOXX) | No — "may not use, share, disclose, transmit, publish, distribute, disseminate, scrape, or commercialize" | No — no index "based in whole or in part on Constituent Data or Derived Constituent Data" | **Prohibited expressly** — "scrape" is named | Storage only "restricted to the Subscriber's own internal use", under a licence | Not stated → **written permission required** |

---

## SEC-filed version vs. issuer-website version — explicit, for all six funds

Same fund, same holdings, same date, **two completely different permission statuses**. This distinction is the operative finding of the audit.

| Fund | Issuer | SEC-filed version (NPORT-P on EDGAR) | Issuer-website version |
|---|---|---|---|
| **VOO** | Vanguard Index Funds | **Republication expressly permitted** — "may be copied or further distributed … without the SEC's permission" ([SEC](https://www.sec.gov/about/privacy-information#dissemination)) | **Expressly prohibited** — no copy/publish/derivative works; personal, noncommercial licence only ([Vanguard](https://investor.vanguard.com/terms-conditions)) |
| **QQQ** | Invesco QQQ Trust | **Republication expressly permitted** (same SEC basis) | **Expressly prohibited** — no republish/derivative/commercial use; robots.txt disallows holdings paths; endpoint returns HTTP 406 ([Invesco](https://www.invesco.com/us/en/resources/terms-of-use.html)) |
| **XLK** | Select Sector SPDR Trust (SSGA) | **Republication expressly permitted** (same SEC basis) | **Expressly prohibited** — "may not be published, redistributed or retransmitted"; sectorspdrs.com 302s to ssga.com ([SSGA](https://www.ssga.com/us/en/footer/terms-and-conditions)) |
| **XLU** | Select Sector SPDR Trust (SSGA) | **Republication expressly permitted** (same SEC basis) | **Expressly prohibited** (same SSGA terms) |
| **SMH** | VanEck ETF Trust | **Republication expressly permitted** (same SEC basis) | **Expressly prohibited** — no reproduction/publication "for commercial purposes without the prior consent of VanEck" ([VanEck](https://www.vaneck.com/us/en/legal/)) |
| **SOXX** | iShares Trust (BlackRock) | **Republication expressly permitted** (same SEC basis) | **Expressly prohibited** — "personal, non-commercial use"; no robots/spiders; download disclaimer restates the same bar ([BlackRock](https://www.blackrock.com/corporate/compliance/terms-and-conditions)) |

Two caveats that apply to the EDGAR column:
1. **Timeliness.** EDGAR gives one snapshot per fiscal quarter, public up to 60 days after quarter end ([17 CFR §270.30b1-9](https://www.ecfr.gov/current/title-17/chapter-II/part-270/section-270.30b1-9)). Issuer sites publish daily. The permitted source is materially staler than the prohibited one.
2. **The index layer survives.** EDGAR permission covers the *filing*. It does not license S&P GICS sector labels, Nasdaq-100 membership branding, MarketVector index data, or ICE constituent data (Section G). Derive sector groupings yourself or from an independently licensed source; never carry over a classification column lifted from an issuer holdings file.

---

## Summary table

| Source | Fund(s) | Verbatim display | Derived aggregate only | Automated download | Caching / storage | Attribution | **Verdict** |
|---|---|---|---|---|---|---|---|
| [SEC EDGAR NPORT-P](https://www.sec.gov/about/privacy-information#dissemination) | VOO, QQQ, XLK, XLU, SMH, SOXX | **Yes** | **Yes** | **Permitted** — ≤10 req/s, declared User-Agent, `/Archives/edgar/data` allowed | **Not restricted** | Requested ("please consider appropriate citation"); no SEC seal/EDGAR logo | **REPUBLICATION EXPRESSLY PERMITTED** |
| [Vanguard](https://investor.vanguard.com/terms-conditions) | VOO | No | No | Prohibited by terms (robots.txt silent on fund paths) | Personal use only → written permission required | No data-attribution licence; logo use needs written permission | **REPUBLICATION EXPRESSLY PROHIBITED** |
| [Invesco](https://www.invesco.com/us/en/resources/terms-of-use.html) | QQQ | No | No | Prohibited (terms + robots.txt holdings/`asOfDate=` disallows + HTTP 406) | "Page caching" only | No; name/logo need written permission | **REPUBLICATION EXPRESSLY PROHIBITED** |
| [SSGA (incl. sectorspdrs.com, which 302s to ssga.com)](https://www.ssga.com/us/en/footer/terms-and-conditions) | XLK, XLU | No | No | **Unaddressed → written permission required** | **Unaddressed → written permission required** | **Yes** — must reproduce all proprietary notices; linking needs written permission | **REPUBLICATION EXPRESSLY PROHIBITED** |
| [VanEck](https://www.vaneck.com/us/en/legal/) | SMH | No | No | Unaddressed in terms; `Crawl-delay: 25`; cookie-gate 302 → written permission required | Personal use only → written permission required | Unaddressed; ABA/S&P CUSIP notice applies | **REPUBLICATION EXPRESSLY PROHIBITED** |
| [iShares / BlackRock](https://www.blackrock.com/corporate/compliance/terms-and-conditions) | SOXX | No | No | **Prohibited expressly** (robot/spider clause); CSV withheld from non-browsers | Personal use only → written permission required | **Yes** — must retain all copyright/proprietary notices; linking needs a written agreement | **REPUBLICATION EXPRESSLY PROHIBITED** |
| [S&P Dow Jones Indices](https://www.spglobal.com/spdji/en/terms-of-use/) | XLK, XLU (GICS sectors) | No | No | robots.txt unretrievable (403) → written permission required | Prohibited ("store" listed) | Not stated → written permission required | **REPUBLICATION EXPRESSLY PROHIBITED** |
| [Nasdaq](https://www.nasdaq.com/legal) | QQQ (Nasdaq-100) | No | No | Prohibited (scraping/data mining named) | Not addressed → written permission required | Text-only homepage link only | **REPUBLICATION EXPRESSLY PROHIBITED** |
| [MarketVector / MVIS](https://www.marketvector.com/terms-of-service) | SMH | No | **No — expressly** | robots.txt unretrievable (403) → written permission required | **Prohibited expressly** (no historical databases) | Not stated → written permission required | **REPUBLICATION EXPRESSLY PROHIBITED** |
| [ICE Data Indices](https://indices.ice.com/html/ICEDisclaimer.htm) | SOXX | No | No | **Prohibited expressly** ("scrape") | Internal-use only under licence | Not stated → written permission required | **REPUBLICATION EXPRESSLY PROHIBITED** |

**Access blocks encountered and reported (no secondary sources substituted):**
- `https://www.invesco.com/us/financial-products/etfs/holdings/...&ticker=QQQ` — HTTP 406, both descriptive and browser User-Agents.
- `https://www.invesco.com/qqq-etf/en/holdings.html` — HTTP 406.
- `https://www.vaneck.com/us/en/investments/semiconductor-etf-smh/holdings/` — HTTP 302 → `/row/disabled-cookies/`.
- `https://www.ishares.com/us/.../SOXX_holdings...csv` — HTTP 200 but HTML body served to scripts instead of CSV.
- `https://www.spglobal.com/robots.txt` — "Access Denied"; `https://www.spglobal.com/spdji/en/robots.txt` — HTTP 403.
- `https://www.marketvector.com/robots.txt` — HTTP 403 (CloudFront).
- `https://www.nasdaq.com/robots.txt` — no response (HTTP 000).
- `https://www.ishares.com/us/legal-information[/terms-and-conditions]` — HTTP 404; footer resolves to the BlackRock corporate terms instead.

---

## Recommended holdings architecture

**One source can lawfully support the public holdings-overlap feature: SEC EDGAR Form NPORT-P.** It is the only source in this audit carrying an affirmative, written republication permission from its publisher — "Information presented on sec.gov is considered public information and may be copied or further distributed by users of the web site without the SEC's permission" ([SEC](https://www.sec.gov/about/privacy-information#dissemination)) — expressly extended to filer-generated content: "All Government-created content on sec.gov and EDGAR public filing content are free to access and reuse" ([SEC Webmaster FAQ](https://www.sec.gov/os/webmaster-faq)).

### What is cleared to build now

1. **Single-source ingest from EDGAR only.** Pull NPORT-P for all six funds (VOO, QQQ, XLK, XLU, SMH, SOXX) from `/Archives/edgar/data/…` and the `data.sec.gov` submissions API. Every downstream feature — full holdings list, top-ten weights, concentration measure, pairwise and multi-fund overlap percentage — derives exclusively from that ingest.
2. **All four display features are cleared against anonymous, ad-supported visitors** when sourced from EDGAR: verbatim complete holdings list, top-ten weights, concentration index, and overlap percentage. No login gate, ad restriction, or noncommercial limitation attaches to EDGAR content.
3. **Compliance controls on ingest:** declared `User-Agent` naming Outfox Markets with an admin contact e-mail, `Accept-Encoding: gzip, deflate`, a hard ceiling of 10 requests/second globally across all workers, and no traffic to `/cgi-bin/` or `/search/` (both Disallowed in [robots.txt](https://www.sec.gov/robots.txt)).
4. **Attribution and labelling.** Cite "Source: SEC EDGAR, Form N-PORT filed by [registrant], period ended [date]" on every holdings and overlap view. Do not display the SEC seal or EDGAR logo, and do not imply SEC affiliation or approval. Show the as-of date and the filing date prominently.
5. **Staleness disclosure is a product requirement, not a nicety.** Under [17 CFR §270.30b1-9](https://www.ecfr.gov/current/title-17/chapter-II/part-270/section-270.30b1-9), only the third month of each fiscal quarter is public, no later than 60 days after quarter end; months one and two "shall not be made publicly available." Label every figure "as of [quarter-end date]" and state that daily holdings are not shown. Do not describe the data as current or daily.
6. **Strip the index layer at ingest.** Do not carry GICS or any sector/sub-industry classification column, do not label output as index constituents, and drop CUSIP columns (ABA / S&P Global Market Intelligence copyright, per [VanEck](https://www.vaneck.com/us/en/legal/)). Where a sector view is wanted, derive groupings from a source Outfox independently controls or licenses, and say so.
7. **Build no dependency on the deferred monthly regime.** The monthly-public amendments are pushed to Nov 17, 2027 / May 18, 2028 ([SEC 2025-64](https://www.sec.gov/newsroom/press-releases/2025-64)) and the SEC has since proposed to "reduce the publication of reports from monthly to quarterly" ([SEC 2026-19](https://www.sec.gov/newsroom/press-releases/2026-19-sec-proposes-amendments-reduce-burdens-reporting-fund-portfolio-holdings)). Quarterly is the planning assumption.

### What is blocked pending written permission

| Blocked capability | Blocked by |
|---|---|
| Any display, verbatim or derived, of holdings obtained from vanguard.com, invesco.com, ssga.com / sectorspdrs.com, vaneck.com, or ishares.com | All five issuers prohibit republication and commercial/derived use (Sections B–F) |
| **Daily or intraday holdings for any of the six funds** | Only issuer sites publish daily; all five prohibit it. EDGAR is quarterly. This is the single largest product gap. |
| Server-side caching or a historical archive built from any issuer-site file | Vanguard/VanEck/BlackRock: personal use only. SSGA: silent → written permission required. Invesco: "page caching" only. MarketVector: "may not store any Data to create historical databases." |
| Scripted/automated download from any issuer site | Vanguard, Invesco, BlackRock prohibit expressly; SSGA and VanEck are silent → written permission required; Invesco and iShares also block technically |
| Displaying GICS sector or sub-industry labels for XLK/XLU | [S&P DJI](https://www.spglobal.com/spdji/en/terms-of-use/) — no copying, storing or derivative works without written consent |
| Labelling QQQ output as Nasdaq-100 constituents, or using Nasdaq index membership/weights | [Nasdaq](https://www.nasdaq.com/legal) §§6–7 |
| Using SMH index data or building any derived chart/report/database from MarketVector data | [MarketVector](https://www.marketvector.com/terms-of-service) §4.1(b)–(d) |
| Using ICE Semiconductor Index constituent data or anything derived from it for SOXX | [ICE](https://indices.ice.com/html/ICEDisclaimer.htm); [ICE Data Indices T&Cs](https://www.ice.com/publicdocs/IDI_-_Terms_and_Conditions_for_the_Index_Data_and_Custom_Index_Services_2026_Changes.pdf) §4 |
| Hyperlinking to ssga.com or any BlackRock site as a source citation | SSGA: "No other site, without the prior written permission … is authorized to link to any part of this Site." BlackRock: "You shall not display hyperlinks on your websites to any website owned or operated by BlackRock." Cite EDGAR filing URLs instead. |
| Using MSCI-sourced analytics columns appearing in iShares files | MSCI notice — "may not be reproduced or redisseminated … may not be used to create any derivative works" |
| Training or developing any model or analytical software on Nasdaq content | [Nasdaq](https://www.nasdaq.com/legal) §7 AI/scraping clause |

### If daily holdings are required

Daily coverage cannot be obtained lawfully from any source examined here without a written agreement. The route is written permission or a licence from each issuer (and, for classification or constituent data, from the relevant index provider): Vanguard at intellectualproperty@vanguard.com; Invesco per Terms §§9–10 ("express prior written consent"); State Street per its Restrictions on use; VanEck ("prior consent of VanEck"); BlackRock ("BlackRock's written permission"); S&P DJI at index_services@spglobal.com; Nasdaq ("prior written approval"); MarketVector (licence agreement per §§2.4, 3); ICE Data ("except as provided in a relevant agreement"). Until such permission is in hand and documented, ship the quarterly EDGAR-sourced feature and label it accurately.

### Residual risk to flag to counsel

- **Browsewrap enforceability.** None of the issuer terms above were accepted through a click-through by an anonymous script; they are browsewrap. This is a defence to *contract* formation in some jurisdictions but does not answer copyright, database, or CFAA/anti-circumvention exposure, and it is not a basis on which to build a public product. The iShares CSV case is the clearest illustration: no acceptance gate, but an active technical block against non-browser clients, which converts an ignore-the-terms strategy into a circumvention question.
- **Compilation copyright.** Individual holdings facts are not copyrightable, but issuers may assert compilation rights in the selection and arrangement of a holdings file. Sourcing from EDGAR and recomputing weights independently substantially reduces this exposure; copying an issuer's file layout does not.
