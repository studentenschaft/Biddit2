import { AuthenticatedTemplate } from "@azure/msal-react";
import { useNavigate } from "react-router-dom";
import { useMsal } from "@azure/msal-react";
import PropTypes from "prop-types";
import { LogoutIcon } from "@heroicons/react/outline";
import { NAV_LABELS, navItemClassName } from "./navItem";
// import { useEffect } from "react";

export default function LogoutButton({ showLabel = false }) {
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
          aria-label={showLabel ? undefined : NAV_LABELS.logout}
          className={navItemClassName(showLabel)}
        >
          <LogoutIcon className="block w-6 h-6 shrink-0" aria-hidden="true" />
          {showLabel && <span>{NAV_LABELS.logout}</span>}
        </button>
      )}
      {console.log("Active Account:", activeAccount)}
      {console.log("Accounts:", accounts)}
    </AuthenticatedTemplate>
  );
}
LogoutButton.propTypes = {
  showLabel: PropTypes.bool,
};

export { LogoutButton };
