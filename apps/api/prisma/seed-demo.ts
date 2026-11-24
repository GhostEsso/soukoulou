import { hash } from '@node-rs/argon2';
import type { PrismaClient } from '@prisma/client';
import { splitYear } from '../src/structure/rules';
import { seedFees } from './seed-demo-fees';

/**
 * École de démonstration (développement uniquement) : un complexe scolaire togolais
 * abonné Premium, vérifié, avec son année, ses niveaux, matières, coefficients et classes.
 * Idempotent : relancer le seed ne duplique rien et ne modifie pas ce que l'école a saisi.
 */

const YEAR = {
  label: '2026-2027',
  startsOn: new Date('2026-10-01'),
  endsOn: new Date('2027-06-30'),
};

// Matières : [nom, abréviation]
const SUBJECTS: [string, string | null][] = [
  ['Français', null],
  ['Anglais', null],
  ['Allemand', null],
  ['Mathématiques', 'Maths'],
  ['Sciences de la vie et de la terre', 'SVT'],
  ['Physique-Chimie', 'PC'],
  ['Histoire-Géographie', 'HG'],
  ['Éducation civique et morale', 'ECM'],
  ['Philosophie', 'Philo'],
  ['Informatique', 'Info'],
  ['Éducation physique et sportive', 'EPS'],
];

const COLLEGE = {
  Français: 4,
  Anglais: 2,
  Mathématiques: 4,
  'Sciences de la vie et de la terre': 2,
  'Physique-Chimie': 2,
  'Histoire-Géographie': 2,
  'Éducation civique et morale': 1,
  Informatique: 1,
  'Éducation physique et sportive': 1,
};
const LYCEE = {
  Français: 3,
  Anglais: 2,
  Mathématiques: 5,
  'Sciences de la vie et de la terre': 4,
  'Physique-Chimie': 5,
  'Histoire-Géographie': 2,
  Informatique: 1,
  'Éducation physique et sportive': 1,
};

// Niveaux dans l'ordre : nom, coefficients, classes [nom, capacité]
const LEVELS: [string, Record<string, number>, [string, number][]][] = [
  [
    '6e',
    COLLEGE,
    [
      ['6e A', 60],
      ['6e B', 60],
      ['6e C', 55],
    ],
  ],
  [
    '5e',
    COLLEGE,
    [
      ['5e A', 60],
      ['5e B', 55],
    ],
  ],
  [
    '4e',
    { ...COLLEGE, Allemand: 1 },
    [
      ['4e A', 55],
      ['4e B', 55],
    ],
  ],
  [
    '3e',
    { ...COLLEGE, Allemand: 1 },
    [
      ['3e A', 55],
      ['3e B', 50],
    ],
  ],
  [
    '2nde',
    LYCEE,
    [
      ['2nde A', 50],
      ['2nde C', 45],
    ],
  ],
  ['1ère', { ...LYCEE, Philosophie: 2 }, [['1ère D', 45]]],
  ['Tle', { ...LYCEE, Philosophie: 3 }, [['Tle D', 45]]],
];

export async function seedDemo(
  prisma: PrismaClient,
  email: string,
  password: string,
) {
  const user =
    (await prisma.user.findUnique({ where: { email } })) ??
    (await prisma.user.create({
      data: {
        email,
        passwordHash: await hash(password),
        firstName: 'Kossi',
        lastName: 'Amegah',
        emailVerifiedAt: new Date(),
      },
    }));

  const premium = await prisma.plan.findUniqueOrThrow({
    where: { code: 'PREMIUM' },
  });
  const membership = await prisma.membership.findFirst({
    where: { userId: user.id, role: 'SCHOOL_ADMIN' },
  });
  const school = membership
    ? await prisma.school.findUniqueOrThrow({
        where: { id: membership.schoolId },
      })
    : await prisma.school.create({
        data: {
          name: 'Complexe Scolaire Les Palmiers',
          slug: 'complexe-scolaire-les-palmiers',
          type: 'COMPLEX',
          ownership: 'PRIVATE_SECULAR',
          country: 'TG',
          city: 'Lomé',
          address: 'Quartier Bè, Lomé',
          phone: '+228 90 00 00 00',
          email,
          approxStudentCount: 650,
          subscriptionStatus: 'ACTIVE',
          verificationStatus: 'VERIFIED',
          verifiedAt: new Date(),
          planId: premium.id,
          subscriptionEndsAt: new Date('2027-06-30'),
          memberships: {
            create: {
              userId: user.id,
              role: 'SCHOOL_ADMIN',
              title: 'Directeur',
            },
          },
        },
      });
  const schoolId = school.id;

  const existingYear = await prisma.academicYear.findUnique({
    where: { schoolId_label: { schoolId, label: YEAR.label } },
  });
  const year =
    existingYear ??
    (await prisma.academicYear.create({
      data: {
        schoolId,
        ...YEAR,
        periodType: 'TRIMESTER',
        isCurrent:
          (await prisma.academicYear.count({ where: { schoolId } })) === 0,
        periods: {
          create: splitYear(YEAR.startsOn, YEAR.endsOn, 'TRIMESTER').map(
            (p, position) => ({ ...p, position }),
          ),
        },
      },
    }));

  const subjectId = new Map<string, string>();
  for (const [name, shortName] of SUBJECTS) {
    const s = await prisma.subject.upsert({
      where: { schoolId_name: { schoolId, name } },
      create: { schoolId, name, shortName },
      update: {},
    });
    subjectId.set(name, s.id);
  }

  for (const [position, [name, coefs, classes]] of LEVELS.entries()) {
    const level = await prisma.level.upsert({
      where: { schoolId_name: { schoolId, name } },
      create: { schoolId, name, position },
      update: { position },
    });
    for (const [subject, coefficient] of Object.entries(coefs)) {
      await prisma.levelSubject.upsert({
        where: {
          levelId_subjectId: {
            levelId: level.id,
            subjectId: subjectId.get(subject)!,
          },
        },
        create: {
          levelId: level.id,
          subjectId: subjectId.get(subject)!,
          coefficient,
        },
        update: {},
      });
    }
    for (const [className, capacity] of classes) {
      await prisma.classroom.upsert({
        where: { yearId_name: { yearId: year.id, name: className } },
        create: {
          schoolId,
          yearId: year.id,
          levelId: level.id,
          name: className,
          capacity,
        },
        update: {},
      });
    }
  }

  await seedStudents(prisma, schoolId, year.id);
  await seedTeachers(prisma, schoolId, year.id);
  await seedAttendance(prisma, schoolId, year.id, user.id, year.startsOn);
  await seedSchedule(prisma, schoolId, year.id);
  await seedGrades(prisma, schoolId, year.id);
  await seedParents(prisma, schoolId);
  await seedFees(prisma, schoolId, year.id, user.id);

  console.log(`École de démo prête : ${school.name} (${email}).`);
}

// ── Élèves ───────────────────────────────────────────────

const BOYS = [
  'Kossi',
  'Komla',
  'Kodjo',
  'Yao',
  'Koffi',
  'Kwami',
  'Edem',
  'Elom',
  'Sena',
  'Mawuli',
  'Folly',
  'Dodzi',
  'Messan',
  'Kokou',
  'Atsu',
  'Koami',
  'Ibrahim',
  'Moussa',
  'Abdou',
  'Rachid',
];
const GIRLS = [
  'Ama',
  'Akossiwa',
  'Adjoa',
  'Afi',
  'Abla',
  'Enyonam',
  'Dela',
  'Esi',
  'Akouvi',
  'Kafui',
  'Yawa',
  'Mawuena',
  'Sika',
  'Dzifa',
  'Edoh',
  'Afiwa',
  'Aïcha',
  'Fatima',
  'Mariam',
  'Salamatou',
];
const LAST = [
  'AMEGAH',
  'MENSAH',
  'AGBEKO',
  'KOUDJO',
  'LAWSON',
  'ATAYI',
  'DOSSOU',
  'AKAKPO',
  'GBEDEMAH',
  'ADJAVON',
  'KPODAR',
  'SOSSOU',
  'AYITE',
  'DJOSSOU',
  'AGBODJAN',
  'TCHALLA',
  'BAMAZE',
  'OURO-AGORO',
  'KOMBATE',
  'ESSO',
];

/** Générateur pseudo-aléatoire déterministe : le seed produit toujours les mêmes élèves. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31;
    return seed / 2 ** 31;
  };
}

/** Remplit chaque classe à 75–95 % de sa capacité, seulement si l'école n'a encore aucun élève. */
async function seedStudents(
  prisma: PrismaClient,
  schoolId: string,
  yearId: string,
) {
  if ((await prisma.student.count({ where: { schoolId } })) > 0) return;
  const rand = rng(2026);
  const pick = <T>(a: T[]) => a[Math.floor(rand() * a.length)];
  const classes = await prisma.classroom.findMany({
    where: { yearId },
    include: { level: { select: { position: true } } },
    orderBy: [{ level: { position: 'asc' } }, { name: 'asc' }],
  });
  let n = 0;
  for (const c of classes) {
    const count = Math.floor((c.capacity ?? 50) * (0.75 + rand() * 0.2));
    // Âge théorique : 11 ans en 6e, un an de plus par niveau.
    const birthYear = 2026 - 11 - c.level.position;
    const students = await prisma.student.createManyAndReturn({
      select: { id: true },
      data: Array.from({ length: count }, () => {
        const girl = rand() < 0.48;
        n++;
        return {
          schoolId,
          matricule: `PAL-2026-${String(n).padStart(4, '0')}`,
          firstName: pick(girl ? GIRLS : BOYS),
          lastName: pick(LAST),
          sex: girl ? ('FEMALE' as const) : ('MALE' as const),
          birthDate: new Date(
            Date.UTC(
              birthYear - (rand() < 0.2 ? 1 : 0),
              Math.floor(rand() * 12),
              1 + Math.floor(rand() * 28),
            ),
          ),
        };
      }),
    });
    await prisma.enrollment.createMany({
      data: students.map((st) => ({
        studentId: st.id,
        yearId,
        classroomId: c.id,
      })),
    });
  }
  console.log(`${n} élèves inscrits.`);
}

// ── Présences ────────────────────────────────────────────

/**
 * Appel de chaque jour ouvré, de la rentrée à aujourd'hui : ~94 % présents, ~4 % absents, ~2 % en retard.
 * Relancé plus tard, complète seulement les jours qui suivent le dernier appel enregistré.
 */
async function seedAttendance(
  prisma: PrismaClient,
  schoolId: string,
  yearId: string,
  takenById: string,
  startsOn: Date,
) {
  const last = await prisma.attendance.aggregate({
    where: { student: { schoolId } },
    _max: { day: true },
  });
  if (last._max.day) startsOn = new Date(last._max.day.getTime() + 86_400_000);
  const rand = rng(1101 + startsOn.getTime() / 86_400_000);
  const enrolled = await prisma.enrollment.findMany({
    where: { yearId, student: { schoolId } },
    select: { studentId: true, classroomId: true },
  });
  const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
  let rows = 0;
  for (
    let d = new Date(startsOn);
    d <= today;
    d = new Date(d.getTime() + 86_400_000)
  ) {
    if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;
    const day = new Date(d);
    const { count } = await prisma.attendance.createMany({
      data: enrolled.map((e) => {
        const r = rand();
        return {
          ...e,
          day,
          takenById,
          status:
            r < 0.04
              ? ('ABSENT' as const)
              : r < 0.06
                ? ('LATE' as const)
                : ('PRESENT' as const),
        };
      }),
    });
    rows += count;
  }
  console.log(`${rows} présences enregistrées.`);
}

// ── Enseignants ──────────────────────────────────────────

const QUARTIERS = [
  'Bè',
  'Tokoin',
  'Adidogomé',
  'Agoè',
  'Hédzranawoé',
  'Nyékonakpoè',
  'Kodjoviakopé',
  'Djidjolé',
  'Avédji',
  'Baguida',
];

/**
 * Un enseignant par tranche de 5 classes et par matière, jusqu'à couvrir toutes les matières de toutes les classes.
 * Seulement si l'école n'a encore aucun enseignant.
 */
async function seedTeachers(
  prisma: PrismaClient,
  schoolId: string,
  yearId: string,
) {
  if ((await prisma.teacher.count({ where: { schoolId } })) > 0) return;
  const rand = rng(77);
  const pick = <T>(a: T[]) => a[Math.floor(rand() * a.length)];
  const classes = await prisma.classroom.findMany({
    where: { yearId },
    orderBy: [{ level: { position: 'asc' } }, { name: 'asc' }],
    select: {
      id: true,
      level: { select: { subjects: { select: { subjectId: true } } } },
    },
  });
  const subjects = await prisma.subject.findMany({
    where: { schoolId },
    orderBy: { name: 'asc' },
  });
  let n = 0;
  const used = new Set<string>();
  for (const subject of subjects) {
    const targets = classes.filter((c) =>
      c.level.subjects.some((s) => s.subjectId === subject.id),
    );
    for (let i = 0; i < targets.length; i += 5) {
      n++;
      const woman = rand() < 0.4;
      let firstName: string, lastName: string;
      do {
        firstName = pick(woman ? GIRLS : BOYS);
        lastName = pick(LAST);
      } while (used.has(firstName + lastName));
      used.add(firstName + lastName);
      const slug = `${firstName}.${lastName}`
        .normalize('NFD')
        .replace(/[^a-zA-Z.]/g, '')
        .toLowerCase();
      await prisma.teacher.create({
        data: {
          schoolId,
          matricule: `ENS-${String(n).padStart(3, '0')}`,
          firstName,
          lastName,
          sex: woman ? 'FEMALE' : 'MALE',
          email: `${slug}@example.com`,
          phone: `+228 9${Math.floor(rand() * 10)} ${String(Math.floor(rand() * 100)).padStart(2, '0')} ${String(Math.floor(rand() * 100)).padStart(2, '0')} ${String(Math.floor(rand() * 100)).padStart(2, '0')}`,
          address: `${pick(QUARTIERS)}, Lomé`,
          teachings: {
            create: targets
              .slice(i, i + 5)
              .map((c) => ({ classroomId: c.id, subjectId: subject.id })),
          },
        },
      });
    }
  }
  console.log(`${n} enseignants affectés.`);
}

// ── Emploi du temps ──────────────────────────────────────

// Heures de cours d'une journée : 07:00–12:00 puis 15:00–17:00, par tranches d'une heure.
const HOURS = [7, 8, 9, 10, 11, 15, 16];

/**
 * Semaine pleine : les 35 heures de chaque classe sont réparties entre ses cours au prorata
 * des coefficients (au moins 1 h), sans conflit de classe ni d'enseignant ; les trous restants
 * vont à un cours de la classe dont l'enseignant est libre. Seulement si l'école n'a aucun créneau.
 */
async function seedSchedule(
  prisma: PrismaClient,
  schoolId: string,
  yearId: string,
) {
  if (
    (await prisma.scheduleSlot.count({
      where: { teaching: { classroom: { schoolId } } },
    })) > 0
  )
    return;
  const rand = rng(515);
  const teachings = await prisma.teachingAssignment.findMany({
    where: { classroom: { schoolId, yearId } },
    select: {
      id: true,
      teacherId: true,
      classroomId: true,
      subjectId: true,
      classroom: {
        select: {
          level: {
            select: {
              subjects: { select: { subjectId: true, coefficient: true } },
            },
          },
        },
      },
    },
  });
  const busy = new Set<string>();
  const cells = [1, 2, 3, 4, 5].flatMap((weekday) =>
    HOURS.map((h) => ({ weekday, h })),
  );
  const data: {
    teachingId: string;
    weekday: number;
    startMin: number;
    endMin: number;
  }[] = [];
  const place = (t: (typeof teachings)[number], weekday: number, h: number) => {
    const kc = `c${t.classroomId}${weekday}-${h}`;
    const kt = `t${t.teacherId}${weekday}-${h}`;
    if (busy.has(kc) || busy.has(kt)) return false;
    busy.add(kc).add(kt);
    data.push({
      teachingId: t.id,
      weekday,
      startMin: h * 60,
      endMin: h * 60 + 60,
    });
    return true;
  };
  const coefOf = (t: (typeof teachings)[number]) =>
    Number(
      t.classroom.level.subjects.find((s) => s.subjectId === t.subjectId)
        ?.coefficient ?? 1,
    );
  const byClass = new Map<string, typeof teachings>();
  for (const t of teachings)
    byClass.set(t.classroomId, [...(byClass.get(t.classroomId) ?? []), t]);
  // Heures voulues par cours : prorata des coefficients, plus forts restes pour tomber juste.
  const need = new Map<string, number>();
  for (const list of byClass.values()) {
    const total = list.reduce((n, t) => n + coefOf(t), 0);
    const exact = list.map((t) => (coefOf(t) / total) * cells.length);
    const hours = exact.map((x) => Math.max(1, Math.floor(x)));
    let left = cells.length - hours.reduce((a, b) => a + b, 0);
    for (const i of exact
      .map((_, i) => i)
      .sort((a, b) => (exact[b] % 1) - (exact[a] % 1))) {
      if (left <= 0) break;
      hours[i]++;
      left--;
    }
    list.forEach((t, i) => need.set(t.id, hours[i]));
  }
  for (const t of [...teachings].sort(() => rand() - 0.5)) {
    let n = need.get(t.id) ?? 1;
    for (const { weekday, h } of [...cells].sort(() => rand() - 0.5)) {
      if (n === 0) break;
      if (place(t, weekday, h)) n--;
    }
  }
  // Trous restants : n'importe quel cours de la classe dont l'enseignant est libre.
  for (const list of byClass.values()) {
    for (const { weekday, h } of cells) {
      if (busy.has(`c${list[0].classroomId}${weekday}-${h}`)) continue;
      for (const t of [...list].sort(() => rand() - 0.5))
        if (place(t, weekday, h)) break;
    }
  }
  const { count } = await prisma.scheduleSlot.createMany({ data });
  console.log(`${count} créneaux d'emploi du temps.`);
}

// ── Notes ────────────────────────────────────────────────

/**
 * Une interrogation et un devoir par cours pour chaque période déjà commencée (avant aujourd'hui),
 * notes autour d'une moyenne propre à chaque cours. Seulement si l'école n'a aucune évaluation.
 */
async function seedGrades(
  prisma: PrismaClient,
  schoolId: string,
  yearId: string,
) {
  if (
    (await prisma.assessment.count({ where: { classroom: { schoolId } } })) > 0
  )
    return;
  const rand = rng(2020);
  const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
  const DAY = 86_400_000;
  const periods = await prisma.period.findMany({
    where: { yearId, startsOn: { lt: today } },
    orderBy: { position: 'asc' },
  });
  const teachings = await prisma.teachingAssignment.findMany({
    where: { classroom: { schoolId, yearId } },
    select: {
      classroomId: true,
      subjectId: true,
      teacherId: true,
      classroom: {
        select: {
          enrollments: { where: { yearId }, select: { studentId: true } },
        },
      },
    },
  });
  let n = 0;
  for (const p of periods) {
    const last = Math.min(p.endsOn.getTime(), today.getTime() - DAY);
    const span = last - p.startsOn.getTime();
    if (span < 14 * DAY) continue;
    const exams: [string, number, number][] = [
      ['Interrogation 1', 0.4, 10],
      ['Devoir 1', 0.85, 20],
    ];
    for (const t of teachings) {
      const level = 9 + rand() * 5; // moyenne du cours entre 9 et 14
      for (const [title, at, maxScore] of exams) {
        const a = await prisma.assessment.create({
          data: {
            classroomId: t.classroomId,
            subjectId: t.subjectId,
            teacherId: t.teacherId,
            periodId: p.id,
            title,
            maxScore,
            day: new Date(
              p.startsOn.getTime() + Math.floor((span * at) / DAY) * DAY,
            ),
          },
        });
        n++;
        await prisma.grade.createMany({
          data: t.classroom.enrollments
            .filter(() => rand() > 0.03) // quelques absents non notés
            .map((e) => {
              const on20 = Math.min(
                20,
                Math.max(0, level + (rand() + rand() + rand() - 1.5) * 7),
              );
              return {
                assessmentId: a.id,
                studentId: e.studentId,
                score: Math.round(((on20 * maxScore) / 20) * 4) / 4,
              };
            }),
        });
      }
    }
  }
  console.log(`${n} évaluations notées.`);
}

// ── Parents ──────────────────────────────────────────────

const PROFESSIONS = [
  'Commerçante',
  'Enseignant',
  'Couturière',
  'Fonctionnaire',
  'Mécanicien',
  'Infirmière',
  'Chauffeur',
  'Comptable',
  'Agriculteur',
  'Revendeuse',
];

/**
 * Familles : élèves de même nom regroupés par 1 à 3 (frères et sœurs), avec un père (85 %)
 * et/ou une mère. Seulement si l'école n'a encore aucun parent.
 */
async function seedParents(prisma: PrismaClient, schoolId: string) {
  if ((await prisma.parent.count({ where: { schoolId } })) > 0) return;
  const rand = rng(4242);
  const pick = <T>(a: T[]) => a[Math.floor(rand() * a.length)];
  const students = await prisma.student.findMany({
    where: { schoolId },
    orderBy: [{ lastName: 'asc' }, { id: 'asc' }],
    select: { id: true, lastName: true },
  });
  const byName = new Map<string, string[]>();
  for (const st of students)
    byName.set(st.lastName, [...(byName.get(st.lastName) ?? []), st.id]);
  let n = 0;
  const phone = () => {
    n++;
    const d = String(10_000_000 + n * 7_919).slice(-6);
    return `+228 9${n % 10} ${d.slice(0, 2)} ${d.slice(2, 4)} ${d.slice(4)}`;
  };
  for (const [lastName, ids] of byName) {
    for (let i = 0; i < ids.length;) {
      const size = 1 + Math.floor(rand() * 3);
      const kids = ids.slice(i, i + size);
      i += size;
      const father = rand() < 0.85;
      const mother = !father || rand() < 0.6;
      const people: [boolean, 'FATHER' | 'MOTHER'][] = [
        [father, 'FATHER'],
        [mother, 'MOTHER'],
      ];
      for (const [present, relation] of people) {
        if (!present) continue;
        const woman = relation === 'MOTHER';
        await prisma.parent.create({
          data: {
            schoolId,
            firstName: pick(woman ? GIRLS : BOYS),
            lastName: woman ? pick(LAST) : lastName,
            phone: phone(),
            address: `${pick(QUARTIERS)}, Lomé`,
            profession: rand() < 0.7 ? pick(PROFESSIONS) : null,
            children: {
              create: kids.map((studentId) => ({ studentId, relation })),
            },
          },
        });
      }
    }
  }
  console.log(`${n} parents rattachés à leurs enfants.`);
}
