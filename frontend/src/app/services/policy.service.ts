import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PolicySummary, PolicyStatus } from '../models/policy.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PolicyService {
  private baseUrl = `${environment.apiUrl}/api/policies`;

  constructor(private http: HttpClient) {}

  getPolicies(filters?: {
    status?: PolicyStatus;
    type?: string;
    lob?: string;
    search?: string;
  }): Observable<PolicySummary[]> {
    let params = new HttpParams();
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.type) params = params.set('type', filters.type);
    if (filters?.lob) params = params.set('lob', filters.lob);
    if (filters?.search) params = params.set('search', filters.search);
    return this.http.get<PolicySummary[]>(this.baseUrl, { params });
  }

  updateStatus(policyRef: string, status: PolicyStatus): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(
      `${this.baseUrl}/${policyRef}/status`,
      { status }
    );
  }
}
