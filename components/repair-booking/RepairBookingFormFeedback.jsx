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
      {error ? (
        <p
          className="form-message"
          style={{
            color: "#ef4444",
            background: "rgba(239,68,68,0.12)",
            borderColor: "rgba(239,68,68,0.25)",
          }}
        >
          {error}
        </p>
      ) : null}

      {message ? <p className="form-message">{message}</p> : null}
    </>
  );
}
