import { Loader } from "lucide-react";
import Loading from "./components/loading";
import { TopBar } from "./components/topbar";

export default function LoadingPage() {
  return (
    <>
      <TopBar
        title={
          <div className="flex gap-2 items-end">
            Caricamento <Loader className="animate-spin" />
          </div>
        }
      />
      <Loading rows={20} />
    </>
  );
}
