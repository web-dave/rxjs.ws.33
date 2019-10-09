import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { EMPTY, Observable, timer } from 'rxjs';
import { Todo, TodoApi } from './models';
import {
  distinctUntilChanged,
  exhaustMap,
  filter,
  map,
  retryWhen,
  shareReplay,
  switchMap,
  take,
  tap
} from 'rxjs/operators';
import { Toolbelt } from './internals';
import { TodoSettings } from './todo-settings.service';

const todosUrl = 'http://localhost:3333/api';

@Injectable()
export class TodoService {
  constructor(
    private http: HttpClient,
    private toolbelt: Toolbelt,
    private settings: TodoSettings
  ) {}

  loadFrequently() {
    return this.settings.settings$.pipe(
      distinctUntilChanged(),
      switchMap(settings => {
        if (settings.isPollingEnabled) {
          return timer(0, settings.pollingInterval).pipe(
            exhaustMap(() => this.query()),
            retryWhen(errors =>
              errors.pipe(switchMap(() => timer(1000).pipe(take(5))))
            ),
            tap({
              error: () => this.toolbelt.offerHardReload()
            })
          );
        }
        return EMPTY;
      }),
      shareReplay(1)
    );
  }

  private query(): Observable<Todo[]> {
    return (
      this.http
        .get<TodoApi[]>(`${todosUrl}`)
        // Task apply mapping
        .pipe(map(todos => todos.map(todo => this.toolbelt.deserialize(todo))))
    );
  }

  create(todo: Todo): Observable<TodoApi> {
    return this.http.post<TodoApi>(todosUrl, todo);
  }

  remove(todoForRemoval: TodoApi): Observable<Todo> {
    return this.http
      .delete<TodoApi>(`${todosUrl}/${todoForRemoval.id}`)
      .pipe(map(todo => this.toolbelt.deserialize(todo)));
  }

  completeOrIncomplete(todoForUpdate: Todo): Observable<Todo> {
    const updatedTodo = this.toggleTodoState(todoForUpdate);
    return this.http
      .put<TodoApi>(
        `${todosUrl}/${todoForUpdate.id}`,
        this.toolbelt.serialize(updatedTodo)
      )
      .pipe(map(todo => this.toolbelt.deserialize(todo)));
  }

  private toggleTodoState(todoForUpdate: Todo): any {
    return {
      ...todoForUpdate,
      isDone: todoForUpdate.isDone ? false : true
    };
  }
}