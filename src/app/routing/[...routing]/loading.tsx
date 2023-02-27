export default function LoadingPage() {
  const loading = Array.from({ length: 10 }, (_, i) => i);
  return (
    <ul role="list" className="divide-y divide-gray-200 border rounded-lg m-2">
      {loading.map((target) => (
        <li key={target} className="px-4 py-2">
          <div className="flex space-x-2 items-stretch justify-between">
            <div className="flex-shrink">
              <div className="w-10 h-10 bg-gray-300 animate-pulse" />
            </div>
            <div className="flex flex-grow flex-col justify-between items-start">
              <div className="bg-gray-300 animate-pulse w-full h-6"></div>
              <div className="bg-gray-300 animate-pulse w-full h-3"></div>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
