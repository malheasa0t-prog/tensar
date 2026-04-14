/**
 * Shows success and error feedback for the repair booking submission flow.
 *
 * @param {{ error: string, message: string }} props
 * @returns {JSX.Element | null}
 */
export default function RepairBookingFormFeedback({ error, message }) {
  if (!error && !message) {
    return null;
  }

  return (
    <>
      {error ? <p className="form-message is-error">{error}</p> : null}

      {message ? <p className="form-message">{message}</p> : null}
    </>
  );
}
