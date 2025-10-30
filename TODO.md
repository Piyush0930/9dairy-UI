# TODO: Move Share All Button to Header on Admin Orders Page

## Tasks
- [x] Remove the "Share All" button from inside the "Order History" tab in the filter container.
- [x] Add a new header section above the filter tabs that displays the "Share All" button only when the "Order History" tab is active.
- [x] Update styles to accommodate the new header and remove unnecessary styles for the button inside the tab.
- [x] Test the UI to ensure no conflicts and proper visibility.

## Notes
- The button should only be visible when `activeFilter === 'history'`.
- Use the existing `shareOverallInvoice` function for the button action.
- Ensure the header is styled consistently with the rest of the UI.
