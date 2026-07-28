import { notFound, redirect } from "next/navigation";
import { ImmersiveRoomLoader } from "@/components/live/ImmersiveRoomLoader";
import {
  getRoomById,
  isRoomComingSoon,
  isRoomId,
  WORKOUT_ROOMS
} from "@/lib/rooms";

type RoomPageProps = {
  params: Promise<{ roomId: string }>;
};

export function generateStaticParams() {
  return WORKOUT_ROOMS.filter((room) => !isRoomComingSoon(room.id)).map(
    (room) => ({ roomId: room.id })
  );
}

export default async function RoomPage({ params }: RoomPageProps) {
  const { roomId } = await params;
  if (!isRoomId(roomId)) notFound();
  if (isRoomComingSoon(roomId)) redirect("/rooms");

  const room = getRoomById(roomId);
  return <ImmersiveRoomLoader room={room} />;
}
