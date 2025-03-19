import { AuthenticatedTemplate } from "@azure/msal-react";
import { useNavigate } from "react-router-dom";
import { useMsal } from "@azure/msal-react";
import { LogoutIcon } from "@heroicons/react/outline";
// import { useEffect } from "react";

export default function LogoutButton() {
  const { instance } = useMsal();
  const activeAccount = instance.getActiveAccount();
  const accounts = instance.getAllAccounts();
  const navigate = useNavigate();

  const handleLogoutRedirect = () => {
    instance.logoutRedirect(navigate("/login")).catch((e) => console.log(e));
  };

  return (
    <AuthenticatedTemplate>
      {(activeAccount || accounts.length > 0) && (
        <button
          onClick={handleLogoutRedirect}
          className="inline-flex items-center justify-center p-2 text-white rounded-md hover:bg-hsg-600 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white active:bg-hsg-800"
        >
          <LogoutIcon className="block w-6 h-6" aria-hidden="true" />
        </button>
      )}
      {console.log("Active Account:", activeAccount)}
      {console.log("Accounts:", accounts)}
    </AuthenticatedTemplate>
  );
}
export { LogoutButton };
