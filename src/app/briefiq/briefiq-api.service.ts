import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AnalyzeBriefRequest,
  BriefAnalysis,
  PrdRequest,
  PrdResponse,
} from './briefiq.models';

@Injectable()
export class BriefiqApiService {
  private readonly http = inject(HttpClient);

  analyzeBrief(brief: string): Observable<BriefAnalysis> {
    const request: AnalyzeBriefRequest = { brief };
    console.info('[BriefIQ][API] POST /api/briefiq/analyze', {
      briefLength: brief.trim().length,
    });

    return this.http.post<BriefAnalysis>('/api/briefiq/analyze', request);
  }

  generatePrd(request: PrdRequest): Observable<PrdResponse> {
    console.info('[BriefIQ][API] POST /api/briefiq/prd', {
      answerCount: request.answers.length,
      assumptionCount: request.assumptions.length,
      openQuestionCount: request.openQuestions.length,
    });

    return this.http.post<PrdResponse>('/api/briefiq/prd', request);
  }
}
