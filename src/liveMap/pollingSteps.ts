import {useQuery} from '@tanstack/react-query';
import type {MovementFile} from "./types";
import { useEffect } from 'react';

// Delay between polls in ms
var pollingSpeed = 250;

export async function fetchLivePositions(step: number): Promise<MovementFile> {
    const res = await fetch(`http://localhost:5000/get_step/${step}`);
    if (!res.ok) {
        throw new Error("Failed to fetch step")
        };
    return res.json();
  }

//const [pollingForState, setPollingForState] = useState(true);

export function useLiveMovement (pollingForState: boolean, step: number, setStep: React.Dispatch<React.SetStateAction<number>>) {
    const query = useQuery({
        queryKey: ['liveData'],
        queryFn: () => fetchLivePositions(step),
        refetchInterval: pollingForState ? 250 : pollingSpeed, // Stops polling when isLive is false
        enabled: pollingForState
        //placeholderData: (keepPreviousData) => keepPreviousData, // Keeps data reference stable mid-fetch
    });
        console.log(step)

    const data = query.data;
    if(query.isSuccess){
        pollingSpeed = 250;
    }
    else{
        pollingSpeed = 1000;
    }
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
  
