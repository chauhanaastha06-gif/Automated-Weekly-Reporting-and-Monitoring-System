const adminLoginBtn =
    document.getElementById(
        "adminLoginBtn"
    );

if (adminLoginBtn) {

    adminLoginBtn.addEventListener(
        "click",
        function () {

            const username =
                document.getElementById(
                    "adminUsername"
                ).value.trim();

            const password =
                document.getElementById(
                    "adminPassword"
                ).value.trim();

            if (
                username === "director" &&
                password === "admin123"
            ) {

                sessionStorage.setItem(
                    "adminLoggedIn",
                    "true"
                );

                alert(
                    "Login successful!"
                );

                window.location.href =
                    "index.html";

            }

            else {

                alert(
                    "Invalid username or password."
                );

            }

        }
    );

}