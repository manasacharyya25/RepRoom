import { LegalPage } from "@/components/legal/LegalPage";

export const metadata = {
  title: "Credits — RhoQ",
  description:
    "Attribution for third-party videos, photos, and icons used on RhoQ, including Pexels and Flaticon creators."
};

const WORKOUT_VIDEOS = [
  {
    creator: "Igor Vieira",
    href: "https://www.pexels.com/video/focused-woman-lifting-weights-in-gym-32239229/"
  },
  {
    creator: "cottonbro studio",
    href: "https://www.pexels.com/video/a-woman-doing-push-ups-in-a-gym-4754031/"
  },
  {
    creator: "Boris Ivas",
    href: "https://www.pexels.com/video/man-weightlifting-at-gym-11652770/"
  },
  {
    creator: "Kampus Production",
    href: "https://www.pexels.com/video/a-man-doing-a-biceps-workout-while-being-supervised-by-his-instructor-6892973/"
  },
  {
    creator: "Gustavo Fring",
    href: "https://www.pexels.com/video/a-woman-exercising-using-dumbbells-6286152/"
  },
  {
    creator: "Kampus Production",
    href: "https://www.pexels.com/video/elderly-people-working-out-6023230/"
  },
  {
    creator: "Instituto Alpha Fitness",
    href: "https://www.pexels.com/video/energetic-woman-exercising-with-dumbbells-in-gym-37609128/"
  },
  {
    creator: "Tima Miroshnichenko",
    href: "https://www.pexels.com/video/a-woman-lifting-weights-6388424/"
  },
  {
    creator: "Amar Preciado",
    href: "https://www.pexels.com/video/woman-working-out-with-dumbbels-at-gym-11121740/"
  },
  {
    creator: "Anastasia Shuraeva",
    href: "https://www.pexels.com/video/couple-lifting-a-barbells-4944398/"
  },
  {
    creator: "Pavel Danilyuk",
    href: "https://www.pexels.com/video/woman-and-man-exercising-with-dumbbells-6326951/"
  }
] as const;

const YOGA_VIDEOS = [
  {
    creator: "Yan Krukau",
    href: "https://www.pexels.com/video/women-doing-workout-together-8480728/"
  },
  {
    creator: "Yan Krukau",
    href: "https://www.pexels.com/video/back-view-of-a-woman-doing-the-cow-face-pose-8480307/"
  },
  {
    creator: "Mikhail Nilov",
    href: "https://www.pexels.com/video/elderly-couple-doing-yoga-7531418/"
  },
  {
    creator: "ROMAN ODINTSOV",
    href: "https://www.pexels.com/video/a-woman-doing-yoga-by-the-ocean-8231495/"
  }
] as const;

const ZUMBA_VIDEOS = [
  {
    creator: "Kampus Production",
    href: "https://www.pexels.com/video/a-woman-dancing-while-looking-at-the-camera-8956472/"
  },
  {
    creator: "cottonbro studio",
    href: "https://www.pexels.com/video/people-doing-exercise-together-7337624/"
  },
  {
    creator: "Ron Lach",
    href: "https://www.pexels.com/video/people-exercising-together-7927850/"
  },
  {
    creator: "Kampus Production",
    href: "https://www.pexels.com/video/women-dancing-gracefully-8956002/"
  }
] as const;

const ROOM_PHOTOS = [
  {
    creator: "Ketut Subiyanto",
    href: "https://www.pexels.com/photo/man-weightlifting-in-gym-4853333/"
  },
  {
    creator: "Vitaly Gariev",
    href: "https://www.pexels.com/photo/group-yoga-session-outdoors-in-fall-park-36715606/"
  },
  {
    creator: "Kampus Production",
    href: "https://www.pexels.com/photo/women-dancing-and-having-fun-8957662/"
  },
  {
    creator: "William Choquette",
    href: "https://www.pexels.com/photo/an-on-treadmill-1954524/"
  },
  {
    creator: "Cup of Couple",
    href: "https://www.pexels.com/photo/a-man-and-woman-sitting-on-a-grassland-6962536/"
  },
  {
    creator: "Andrea Piacquadio",
    href: "https://www.pexels.com/photo/people-holding-a-weights-3766211/"
  },
  {
    creator: "Ali Alcántara",
    href: "https://www.pexels.com/photo/man-exercising-shirtless-14591553/"
  },
  {
    creator: "Wendell Stoyer",
    href: "https://www.pexels.com/photo/woman-preparing-for-workout-in-gym-environment-35419768/"
  },
  {
    creator: "Tima Miroshnichenko",
    href: "https://www.pexels.com/photo/a-man-and-woman-in-black-tank-top-working-out-inside-the-gym-6388367/"
  },
  {
    creator: "Andrea Piacquadio",
    href: "https://www.pexels.com/photo/three-women-s-doing-exercises-863977/"
  },
  {
    creator: "Airam Dato-on",
    href: "https://www.pexels.com/photo/woman-pushing-a-gym-equipment-13106608/"
  },
  {
    creator: "Airam Dato-on",
    href: "https://www.pexels.com/photo/a-man-and-an-woman-standing-beside-weight-plates-13106609/"
  },
  {
    creator: "Tnarg",
    href: "https://www.pexels.com/photo/woman-working-out-at-gym-5132095/"
  },
  {
    creator: "Viridiana Rivera",
    href: "https://www.pexels.com/photo/man-and-woman-exercising-together-14591736/"
  },
  {
    creator: "Pavel Danilyuk",
    href: "https://www.pexels.com/photo/people-stretching-using-dumbbells-6339480/"
  },
  {
    creator: "Kampus Production",
    href: "https://www.pexels.com/photo/man-training-on-gym-with-barbell-6922164/"
  },
  {
    creator: "Airam Dato-on",
    href: "https://www.pexels.com/photo/a-woman-in-sports-bra-and-black-shorts-is-sitting-on-gym-equipment-13106579/"
  }
] as const;

const FLATICON_CREDITS = [
  {
    label: "Room icons",
    creator: "Iconjam",
    href: "https://www.flaticon.com/free-icons/room",
    title: "room icons"
  },
  {
    label: "Share post icons",
    creator: "Magnific",
    href: "https://www.flaticon.com/free-icons/share-post",
    title: "share post icons"
  },
  {
    label: "Social media post icons",
    creator: "POD Gladiator",
    href: "https://www.flaticon.com/free-icons/social-media-post",
    title: "social media post icons"
  }
] as const;

function VideoCreditList({
  items
}: {
  items: readonly { creator: string; href: string }[];
}) {
  return (
    <ul>
      {items.map((item) => (
        <li key={item.href}>
          Video by {item.creator}:{" "}
          <a href={item.href} rel="noopener noreferrer" target="_blank">
            {item.href}
          </a>
        </li>
      ))}
    </ul>
  );
}

function PhotoCreditList({
  items
}: {
  items: readonly { creator: string; href: string }[];
}) {
  return (
    <ul>
      {items.map((item) => (
        <li key={item.href}>
          Photo by {item.creator}:{" "}
          <a href={item.href} rel="noopener noreferrer" target="_blank">
            {item.href}
          </a>
        </li>
      ))}
    </ul>
  );
}

export default function CreditsPage() {
  return (
    <LegalPage path="/credits" title="Credits" updated="August 3, 2026">
      <p>
        Some landing videos, room photos, and UI icons on RhoQ come from
        third-party creators. We thank them for their work.
      </p>

      <h2>Videos — Workout</h2>
      <VideoCreditList items={WORKOUT_VIDEOS} />

      <h2>Videos — Yoga</h2>
      <VideoCreditList items={YOGA_VIDEOS} />

      <h2>Videos — Zumba</h2>
      <VideoCreditList items={ZUMBA_VIDEOS} />

      <h2>Photos — Rooms</h2>
      <PhotoCreditList items={ROOM_PHOTOS} />

      <p>
        Videos and photos hosted on{" "}
        <a
          href="https://www.pexels.com"
          rel="noopener noreferrer"
          target="_blank"
        >
          Pexels
        </a>
        .
      </p>

      <h2>Icons — Flaticon</h2>
      <ul>
        {FLATICON_CREDITS.map((item) => (
          <li key={item.href}>
            <a href={item.href} rel="noopener noreferrer" target="_blank" title={item.title}>
              {item.label}
            </a>{" "}
            created by {item.creator} — Flaticon
          </li>
        ))}
      </ul>
    </LegalPage>
  );
}
