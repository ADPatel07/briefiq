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

    return this.http.post<BriefAnalysis>('/api/briefiq/analyze', request);
  }

  generatePrd(request: PrdRequest): Observable<PrdResponse> {
    return this.http.post<PrdResponse>('/api/briefiq/prd', request);
  }
}
