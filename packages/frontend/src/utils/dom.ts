// DOM操作工具类
export class DOMUtils {
  // 安全的查询选择器
  static query<T extends Element = Element>(selector: string, parent?: Element): T | null {
    const context = parent || document;
    return context.querySelector<T>(selector);
  }

  // 查询所有元素
  static queryAll<T extends Element = Element>(selector: string, parent?: Element): T[] {
    const context = parent || document;
    return Array.from(context.querySelectorAll<T>(selector));
  }

  // 创建元素
  static createElement<K extends keyof HTMLElementTagNameMap>(
    tagName: K,
    options?: {
      className?: string;
      id?: string;
      textContent?: string;
      innerHTML?: string;
      attributes?: Record<string, string>;
    }
  ): HTMLElementTagNameMap[K] {
    const element = document.createElement(tagName);
    
    if (options) {
      if (options.className) element.className = options.className;
      if (options.id) element.id = options.id;
      if (options.textContent) element.textContent = options.textContent;
      if (options.innerHTML) element.innerHTML = options.innerHTML;
      if (options.attributes) {
        Object.entries(options.attributes).forEach(([key, value]) => {
          element.setAttribute(key, value);
        });
      }
    }
    
    return element;
  }

  // 切换类名
  static toggleClass(element: Element, className: string, force?: boolean): void {
    element.classList.toggle(className, force);
  }

  // 添加事件监听器
  static addEventListener<K extends keyof HTMLElementEventMap>(
    element: Element,
    type: K,
    listener: (event: HTMLElementEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions
  ): void {
    element.addEventListener(type, listener as EventListener, options);
  }

  // 移除事件监听器
  static removeEventListener<K extends keyof HTMLElementEventMap>(
    element: Element,
    type: K,
    listener: (event: HTMLElementEventMap[K]) => void,
    options?: boolean | EventListenerOptions
  ): void {
    element.removeEventListener(type, listener as EventListener, options);
  }

  // 显示元素
  static show(element: HTMLElement): void {
    element.style.display = '';
    element.removeAttribute('hidden');
  }

  // 隐藏元素
  static hide(element: HTMLElement): void {
    element.style.display = 'none';
  }

  // 切换显示状态
  static toggleVisibility(element: HTMLElement, show?: boolean): void {
    if (show === undefined) {
      show = element.style.display === 'none';
    }
    
    if (show) {
      this.show(element);
    } else {
      this.hide(element);
    }
  }

  // 设置文本内容
  static setText(element: Element, text: string): void {
    element.textContent = text;
  }

  // 设置HTML内容
  static setHTML(element: Element, html: string): void {
    element.innerHTML = html;
  }

  // 清空元素
  static clear(element: Element): void {
    element.innerHTML = '';
  }

  // 获取表单数据
  static getFormData(form: HTMLFormElement): Record<string, string> {
    const formData = new FormData(form);
    const data: Record<string, string> = {};
    
    for (const [key, value] of formData.entries()) {
      data[key] = value.toString();
    }
    
    return data;
  }

  // 设置表单数据
  static setFormData(form: HTMLFormElement, data: Record<string, string>): void {
    Object.entries(data).forEach(([key, value]) => {
      const input = form.querySelector<HTMLInputElement>(`[name="${key}"]`);
      if (input) {
        input.value = value;
      }
    });
  }

  // 禁用表单
  static disableForm(form: HTMLFormElement): void {
    this.queryAll<HTMLInputElement>('input, select, textarea, button', form).forEach(element => {
      element.disabled = true;
    });
  }

  // 启用表单
  static enableForm(form: HTMLFormElement): void {
    this.queryAll<HTMLInputElement>('input, select, textarea, button', form).forEach(element => {
      element.disabled = false;
    });
  }

  // 滚动到元素
  static scrollToElement(element: Element, behavior: ScrollBehavior = 'smooth'): void {
    element.scrollIntoView({ behavior });
  }

  // 等待DOM加载完成
  static ready(callback: () => void): void {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback);
    } else {
      callback();
    }
  }

  // 防抖函数
  static debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    
    return function(this: any, ...args: Parameters<T>) {
      const later = () => {
        clearTimeout(timeout);
        func.apply(this, args);
      };
      
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // 节流函数
  static throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    
    return function(this: any, ...args: Parameters<T>) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
}

// 导出工具函数
export const {
  query,
  queryAll,
  createElement,
  toggleClass,
  addEventListener,
  removeEventListener,
  show,
  hide,
  toggleVisibility,
  setText,
  setHTML,
  clear,
  getFormData,
  setFormData,
  disableForm,
  enableForm,
  scrollToElement,
  ready,
  debounce,
  throttle
} = DOMUtils;