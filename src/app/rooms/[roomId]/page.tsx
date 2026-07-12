import { notFound } from "next/navigation";
import { ImmersiveRoomRoute } from "@/components/live/ImmersiveRoomRoute";
import { getRoomById, isRoomId, WORKOUT_ROOMS } from "@/lib/rooms";
import "@/app/landing.css";
import "@/app/live-rooms.css";

type RoomPageProps = {
  params: Promise<{ roomId: string }>;
};

export function generateStaticParams() {
  return WORKOUT_ROOMS.map((room) => ({ roomId: room.id }));
}

export default async function RoomPage({ params }: RoomPageProps) {
  const { roomId } = await params;
  if (!isRoomId(roomId)) notFound();

  const room = getRoomById(roomId);
  return <ImmersiveRoomRoute room={room} />;
}
