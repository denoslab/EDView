import type {ReplayAgentDelta, ReplayFrame } from "@/replay/types";
import {useQuery} from '@tanstack/react-query';
import type {MovementFile, PersonaDetailsMovementFile, PersonaMovementFile } from "./types";
import { useEffect, useRef } from 'react';


export async function fetchLivePositions(step: number): Promise<ReplayFrame> {
    const res = await fetch(`http://localhost:5000/get_step/${step}`);
    if (!res.ok) {
        throw new Error("Failed to fetch step")
        };
    return res.json();
  }

//const [pollingForState, setPollingForState] = useState(true);

export function useLiveMovement (pollingForState: boolean, step: number, setStep: React.Dispatch<React.SetStateAction<number>>) {
     const lastSeenSimTime = useRef<string | number | null>(null);
    const query = useQuery({
        queryKey: ['liveData'],
        queryFn: () => fetchLivePositions(step),
        refetchInterval: pollingForState ? 3000 : false, // Stops polling when isLive is false
        enabled: pollingForState
        //placeholderData: (keepPreviousData) => keepPreviousData, // Keeps data reference stable mid-fetch
    });
        console.log(step)

    const data = query.data;

   // const currentSimTime = query.data?.simTime;
    useEffect(() => {
        if (data && pollingForState)  {
            // Use functional update to ensure we don't use a stale step closure
            //lastSeenSimTime.current = currentSimTime;
            setStep(prev => prev + 1);
        }
    }, [data, pollingForState, setStep]);

    if (!data || !pollingForState) {
        return;
    }



    //setStep(step + 1);
    console.log(data)
    return data;
}
  
