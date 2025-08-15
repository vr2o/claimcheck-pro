export default function ProgressSteps({ stage, message }:{ stage:string; message:string }) {
  const steps = ['queue','extract','discover','assess','done'];
  const idx = Math.max(steps.indexOf(stage), 0);
  return (
    <div className="w-full">
      <div className="flex gap-2">
        {steps.map((s, i)=>(
          <div key={s} className={`flex-1 h-2 rounded ${i<=idx?'bg-black':'bg-gray-200'}`} />
        ))}
      </div>
      <p className="text-sm mt-2">{message}</p>
    </div>
  );
}
