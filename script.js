const $ = id => document.getElementById(id);

const fields = [
    "employeeId",
    "fullName",
    "designation",
    "department",
    "joiningDate",
    "bloodGroup",
    "emergency",
    "status",
    "hospitalPhone",
    "hospitalEmail",
    "hospitalAddress"
];

const imgs = {
    photo: "photo",
    logo: "logo",
    staffSig: "staffSig",
    doctorSig: "doctorSig"
};

const savedImages = {};

/* =========================
   DATE FORMAT
========================= */
function fmtDate(v) {
    if (!v) return "—";

    const d = new Date(v + "T00:00:00");

    return (
        String(d.getDate()).padStart(2, "0") +
        "-" +
        String(d.getMonth() + 1).padStart(2, "0") +
        "-" +
        d.getFullYear()
    );
}

/* =========================
   LIVE PREVIEW UPDATE
========================= */
function update() {

    $("pName").textContent =
        $("fullName").value || "STAFF NAME";

    $("pDesignation").textContent =
        ($("designation").value || "DESIGNATION").toUpperCase();

    $("pId").textContent =
        $("employeeId").value || "—";

    $("pDept").textContent =
        ($("department").value || "—").toUpperCase();

    $("pDes").textContent =
        ($("designation").value || "—").toUpperCase();

    $("pBlood").textContent =
        $("bloodGroup").value || "—";

    /* BACK CARD */

    $("bId").textContent =
        $("employeeId").value || "—";

    $("bName").textContent =
        $("fullName").value || "—";

    $("bDes").textContent =
        ($("designation").value || "—").toUpperCase();

    $("bDept").textContent =
        ($("department").value || "—").toUpperCase();

    $("bDate").textContent =
        fmtDate($("joiningDate").value);

    $("bEmergency").textContent =
        $("emergency").value || "—";
        /* HOSPITAL DETAILS - BACK CARD */

$("phoneBack").textContent =
    $("hospitalPhone").value || "—";

$("emailBack").textContent =
    $("hospitalEmail").value || "—";

$("addressBack").textContent =
    $("hospitalAddress").value || "—";

    /* STATUS */

    $("statusBadge").textContent =
        $("status").value;

    if ($("status").value === "ACTIVE") {

        $("statusBadge").style.background = "#d9f8df";
        $("statusBadge").style.color = "#08752a";

    } else {

        $("statusBadge").style.background = "#ffd9d9";
        $("statusBadge").style.color = "#b00000";

    }
}

/* =========================
   TEXT FIELD EVENTS
========================= */

fields.forEach(id => {

    const element = $(id);

    if (element) {
        element.addEventListener("input", update);
        element.addEventListener("change", update);
    }

});

/* =========================
   IMAGE UPLOAD
========================= */

Object.values(imgs).forEach(id => {

    const input = $(id);

    if (!input) return;

    input.addEventListener("change", function (e) {

        const file = e.target.files[0];

        if (!file) return;

        /* Check image */
        if (!file.type.startsWith("image/")) {

            alert("Please select an image file.");

            input.value = "";

            return;
        }

        const reader = new FileReader();

        reader.onload = function (ev) {

            const imageData = ev.target.result;

            /* Save image */
            savedImages[id] = imageData;

            /* Show filename */
            const nameElement = $(id + "Name");

            if (nameElement) {
                nameElement.textContent = file.name;
            }

            /* STAFF PHOTO */
            if (id === "photo") {

                $("photoPreview").src = imageData;

            }

            /* HOSPITAL LOGO */
            if (id === "logo") {

                $("logoBox").innerHTML =
                    '<img src="' +
                    imageData +
                    '" alt="Hospital Logo">';

                $("headerLogo").src = imageData;

            }

            /* STAFF SIGNATURE */
            
if (id === "staffSig") {

    const sigPreview = $("staffSigPreview");

    sigPreview.src = imageData;
    sigPreview.style.display = "block";
    sigPreview.style.visibility = "visible";
    sigPreview.style.opacity = "1";
    console.log("Staff signature loaded successfully");

}

            /* DOCTOR SIGNATURE */
            if (id === "doctorSig") {

                $("doctorSigPreview").src = imageData;

            }

        };

        reader.onerror = function () {

            alert("Unable to read the selected image.");

        };

        reader.readAsDataURL(file);

    });

});

/* =========================
   GET FORM DATA
========================= */

function data() {

    let o = {};

    fields.forEach(id => {

        o[id] = $(id).value;

    });

    o.images = savedImages;

    return o;
}

/* =========================
   UPDATE QR CODE
========================= */

async function updateQR(employeeId) {

    try {

        if (!employeeId) return;

        const response = await fetch(
            "/api/qr/" + encodeURIComponent(employeeId)
        );

        const result = await response.json();

        if (result.success) {

            $("qrBox").innerHTML =
                '<img src="' +
                result.dataUrl +
                '" alt="QR Code">';

        }

    } catch (error) {

        console.log("QR Error:", error);

    }

}

/* =========================
   SAVE STAFF RECORD
========================= */

$("saveBtn").onclick = async function () {

    const o = data();

    /* Required fields */

    if (
        !o.employeeId ||
        !o.fullName ||
        !o.designation ||
        !o.department
    ) {

        alert("Please fill all required fields.");

        return;

    }

    try {

        const payload = {

            employee_id: o.employeeId,

            name: o.fullName,

            designation: o.designation,

            department: o.department,

            date_of_joining: o.joiningDate,

            blood_group: o.bloodGroup,

            emergency_contact: o.emergency,

            phone: o.hospitalPhone,

            email: o.hospitalEmail,

            address: o.hospitalAddress,

            photo: o.images.photo || null,

            staff_signature: o.images.staffSig || null,

            doctor_signature: o.images.doctorSig || null,

            status: o.status

        };

        const response = await fetch(
            "/api/staff",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify(payload)
            }
        );

        const result = await response.json();

        if (!response.ok) {

            throw new Error(
                result.message || "Save failed"
            );

        }

        /* Local backup */

        localStorage.setItem(
            "namagiriStaffRecord",
            JSON.stringify(o)
        );

        /* Generate QR */

        await updateQR(o.employeeId);

        alert(
            "Staff record saved successfully to PostgreSQL."
        );

    } catch (error) {

        /* Local backup even if backend fails */

        localStorage.setItem(
            "namagiriStaffRecord",
            JSON.stringify(o)
        );

        alert(
            "Backend save failed: " +
            error.message +
            "\nLocal backup was saved."
        );

    }

};

/* =========================
   LOAD SAVED RECORD
========================= */

$("loadBtn").onclick = function () {

    const saved =
        localStorage.getItem("namagiriStaffRecord");

    if (!saved) {

        alert("No saved staff record found.");

        return;

    }

    const o = JSON.parse(saved);

    /* Restore fields */

    fields.forEach(id => {

        if (o[id] !== undefined) {

            $(id).value = o[id];

        }

    });

    /* Restore images */

    Object.assign(
        savedImages,
        o.images || {}
    );

    /* Staff Photo */

    if (savedImages.photo) {

        $("photoPreview").src =
            savedImages.photo;

    }

    /* Hospital Logo */

    if (savedImages.logo) {

        $("logoBox").innerHTML =
            '<img src="' +
            savedImages.logo +
            '" alt="Hospital Logo">';

        $("headerLogo").src =
            savedImages.logo;

    }

    /* STAFF SIGNATURE */
if (id === "staffSig") {

    const sigPreview = $("staffSigPreview");

    if (sigPreview) {
        sigPreview.src = imageData;

        sigPreview.style.display = "block";
        sigPreview.style.visibility = "visible";
        sigPreview.style.opacity = "1";
        sigPreview.style.width = "120px";
        sigPreview.style.height = "50px";
        sigPreview.style.objectFit = "contain";

        sigPreview.onload = function () {
            console.log("STAFF SIGNATURE IMAGE DISPLAYED");
        };

        sigPreview.onerror = function () {
            console.log("STAFF SIGNATURE IMAGE FAILED");
        };
    }
}

    /* Doctor Signature */

    if (savedImages.doctorSig) {

        $("doctorSigPreview").src =
            savedImages.doctorSig;

    }

    update();

    updateQR($("employeeId").value);

    alert("Saved record loaded.");

};

/* =========================
   CLEAR FORM
========================= */

$("clearBtn").onclick = function () {

    if (confirm("Clear the current form?")) {

        location.reload();

    }

};

/* =========================
   NEW RECORD
========================= */

$("newBtn").onclick = function () {

    if (
        confirm(
            "Start a new staff record?"
        )
    ) {

        fields.forEach(id => {

            $(id).value = "";

        });

        $("department").value =
            "OP (Outpatient)";

        $("status").value =
            "ACTIVE";

        Object.keys(savedImages).forEach(key => {

            delete savedImages[key];

        });

        update();

    }

};

/* =========================
   PRINT
========================= */

$("printTop").onclick = function () {

    window.print();

};

/* =========================
   INITIAL UPDATE
========================= */

update();