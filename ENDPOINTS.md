# Pages → RSMS endpoints

All verified against a live session. The extension runs on the portal's own origin, so every
request below is a plain same-origin `fetch()` that carries the session cookies.

## Reports

| View            | Request                                                        | Notes |
|-----------------|----------------------------------------------------------------|-------|
| Overview        | `Marks_Rexa.asp`, `Academic_Calendar.asp`, `Leave.asp`, `Notice.asp` | |
| Attendance      | `GET Leave.asp?code=`                                          | Only leave/duty entries, no percentage. Legend colours are fixed: `#9f0000` Leave, `#006600` Approved leave, `#ff9900` Duty leave, `#cccc00` Duty attendance |
| Internal marks  | `GET Mark.asp?code=&E_ID=`, `GET Mark_Sessional.asp?code=`     | `E_ID` options are embedded in the `Mark.asp?code=` response (16 types). Header cell is `<b>code</b><br>max` |
| Mark split-up   | `POST Mark_Internal_Report.asp` with `Class_Code`, then `+Subject_Code`, then `+E_Id` | Three-step drill-down; current semester only. `E_Id` 10 = Internal Exam 1, 11 = Internal Exam 2, 12 = Assignment. Result table: `Qn.N Max:M … Total` |
| Results         | `GET Marks_Rexa.asp`                                           | All semesters in one page, with per-semester SGPA and CGPA |
| Calendar        | `GET Academic_Calendar.asp?Dater=M/20/YYYY`                    | Each day is a nested table: day / `» event` rows / working-day counter (`title="Working day number…"`) |
| Activity points | `POST Activity.asp` `Class_Code`+`ACode`                       | Read-only. Entries are scoped by class code (semester of submission). `ACode` 11–27; 23–27 = Startup, Patent, Product/Prototype, Society/Club, Elected representative. Column 14 (labelled "Rating By Faculty") is actually the points |
| Notices         | `GET Notice.asp[?NID=&NC=68]`                                  | UTF-8 page; body is stored HTML (often just a base64 image). Sanitised before render |
| Fees            | `GET FeeBook.asp`                                              | Receipt link = `Receipt.asp?OId=` from the button's `onclick` |
| Certificates    | `GET Certificate.asp`                                          | |
| Profile         | `GET FileUp.php`                                               | Label/value rows |

## Identifiers

- **Class code**: `{AdmissionYear}S{Sem}{Branch}-{Section}`, e.g. `2026S7CS-A`. The list comes from the `code` dropdown on `Mark.asp`.
- **Semester code** (only `Mark_Rexa.asp`): `S{N}{AdmissionYear}{Branch}`, e.g. `S32023CS`. Not needed — `Marks_Rexa.asp` covers all semesters.

## Encoding

Most pages are windows-1252; notices are UTF-8. `js/api.js` tries strict UTF-8 first and falls back.
