import { TestBed } from '@angular/core/testing';

import { VscodeApiService } from './vscode-api.service';

describe('VscodeApiService', () => {
  let service: VscodeApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(VscodeApiService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
