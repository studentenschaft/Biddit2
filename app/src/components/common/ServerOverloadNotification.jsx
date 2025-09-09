import { toast } from 'react-toastify';
import ServerOverloadToast from './ServerOverloadToast';

export const showServerOverloadNotification = () => {
  toast.warning(
    <ServerOverloadToast 
      onDismiss={() => toast.dismiss()}
    />,
    {
      position: "top-center",
      autoClose: false,
      hideProgressBar: true,
      closeOnClick: false,
      pauseOnHover: true,
      draggable: true,
      closeButton: false,
    }
  );
};