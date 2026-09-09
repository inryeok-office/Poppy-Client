import { redirect } from 'next/navigation';

// 조립 완료 상태는 이제 /experience 의 세션 상태로 표현된다.
// 기존 북마크·공유 링크 호환을 위해 통합 화면으로 리디렉션한다.
export default function ExperienceAssembledRedirect() {
  redirect('/experience');
}
