import { MailIcon } from "@heroicons/react/outline";

// Button for email
export default function ContactButton() {
  return (
    <a href="mailto:biddit@shsg.ch">
      <div
        className="inline-flex items-center justify-center p-2 text-white rounded-md hover:bg-hsg-600 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white active:bg-hsg-800"
        onClick={null}
      >
        <MailIcon className="block w-6 h-6" aria-hidden="true" />
      </div>
    </a>
  );
}

export { ContactButton };
