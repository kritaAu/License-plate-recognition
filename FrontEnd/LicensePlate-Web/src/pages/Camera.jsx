// src/pages/Camera.jsx
import "bootstrap/dist/css/bootstrap.min.css";

export default function Camera() {
  const streamUrl = "http://localhost:8000/video"; // เปลี่ยนเป็นของจริงได้

  return (
    <div className="container py-4">
      <h2 className="mb-3">กล้องตรวจจับ</h2>

      <div className="row g-4">
        <div className="col-lg-5">
          <div className="card border-0 shadow-sm" style={{ background: "#c7d9e8" }}>
            <div className="card-body p-3">
              <h3 className="fw-semibold mb-2">In</h3>
              <div className="ratio ratio-16x9">
                <img
                  src={`${streamUrl}?cam=in`}
                  alt="Live Stream IN"
                  className="w-100 h-100 object-fit-cover rounded"
                />
              </div>
            </div>
          </div>

          <div className="card border-0 shadow-sm mt-4" style={{ background: "#c7d9e8" }}>
            <div className="card-body p-3">
              <h3 className="fw-semibold mb-2">Out</h3>
              <div className="ratio ratio-16x9">
                <img
                  src={`${streamUrl}?cam=out`}
                  alt="Live Stream OUT"
                  className="w-100 h-100 object-fit-cover rounded"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-7">
          <div className="card h-100 shadow-sm border-primary">
            <div className="card-body bg-dark text-white rounded">
              <h3 className="mb-3">Log</h3>
              <div className="bg-white rounded p-3" style={{ minHeight: "60vh" }}>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}