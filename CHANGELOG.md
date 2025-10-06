# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2025-10-06
### Added
- Enforced timezone on contact creation by sending `timezone` and following up with PATCH/PUT using `timezone` and `timeZone` keys; added fallbacks to aliases (`US/Eastern`, `US/Central`, etc.) if IANA values are rejected.
- Improved duplicate detection: now requires exact email match or normalized 10‑digit phone match.
- Expanded logging around contact search and timezone updates for easier troubleshooting.

### Removed
- Removed custom-field `timezone` from the payload to avoid confusion with native contact timezone.

## [1.0.0] - 2024-12-01
### Initial
- Initial release with contact scraping, transfer, workflow enrollment, and API key storage.


