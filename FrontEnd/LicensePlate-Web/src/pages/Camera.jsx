import "bootstrap/dist/css/bootstrap.min.css";
import Navbar from "./navbar";
function Camera() {
    return (
        <div>
            <div >
                <Navbar/>
                <h2>กล้องตรวจจับ</h2>
                <div class="col-md-12 themed-grid-col">
                <div class = "pb-3"><p>สตรีมภาพจากกล้อง FastAPI:</p></div>
                    <div class = "row">
                        <div class="col-md-3 themed-grid-col">
                        <img
                            src="http://localhost:8000/video"
                            alt="Live Stream"
                            className="img-fluid w-99.6 rounded"
                        />
                        </div>
                        <div class="col-md-3 themed-grid-col">
                        <img
                            src="http://localhost:8000/video"
                            alt="Live Stream"
                            className="img-fluid w-99.6 rounded"
                        />
                        </div>
                        <div class="col-md-6 themed-grid-col">
                            <div class="h-100 p-5 text-bg-dark rounded-3">
                                <h1 color="white">Log</h1>
                                <div class="h-100 p-5 text-bg-white rounded-3">

                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Camera;


